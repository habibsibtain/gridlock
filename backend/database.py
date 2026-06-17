"""
Database — SQLite setup and data pipeline.
Loads CSV data, computes derived fields, and provides query functions.
"""

import sqlite3
import os
import pandas as pd
import math
from datetime import datetime
from typing import Optional, List

from services.ecrs_engine import compute_base_ecrs, normalize_ecrs

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CSV_PATH = os.path.join(BASE_DIR, "Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv")
DB_PATH = os.path.join(BASE_DIR, "astram.db")

_connection = None


def get_connection() -> sqlite3.Connection:
    """Get or create the database connection."""
    global _connection
    if _connection is None:
        _connection = sqlite3.connect(DB_PATH, check_same_thread=False)
        _connection.row_factory = sqlite3.Row
    return _connection


def init_database():
    """Initialize the database — load CSV, compute fields, create tables."""
    if os.path.exists(DB_PATH):
        # Check if already populated
        conn = get_connection()
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='incidents'")
        if cursor.fetchone():
            count = conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
            if count > 0:
                print(f"Database already initialized with {count} records.")
                _ensure_hotspots_table(conn)
                return
    
    print("Loading CSV data...")
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df)} records.")
    
    # Parse datetime columns
    datetime_cols = ["start_datetime", "end_datetime", "closed_datetime", "resolved_datetime", "modified_datetime", "created_date"]
    for col in datetime_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)
    
    # Clean coordinates — treat 0 as null
    for col in ["endlatitude", "endlongitude", "resolved_at_latitude", "resolved_at_longitude"]:
        if col in df.columns:
            df[col] = df[col].replace(0, pd.NA).replace(0.0, pd.NA)
    
    # Compute duration_minutes: prefer closed_datetime, fallback to end_datetime
    df["effective_end"] = df["closed_datetime"].fillna(df["end_datetime"]).fillna(df["resolved_datetime"])
    df["duration_minutes"] = pd.NA
    
    mask = df["start_datetime"].notna() & df["effective_end"].notna()
    df.loc[mask, "duration_minutes"] = (
        (df.loc[mask, "effective_end"] - df.loc[mask, "start_datetime"]).dt.total_seconds() / 60.0
    )
    
    # Filter outliers: cap at 24 hours, remove negatives
    df.loc[df["duration_minutes"] > 1440, "duration_minutes"] = pd.NA
    df.loc[df["duration_minutes"] < 0, "duration_minutes"] = pd.NA
    
    # Extract time components
    df["hour_of_day"] = df["start_datetime"].dt.hour
    df["day_of_week"] = df["start_datetime"].dt.dayofweek  # 0=Mon
    df["month"] = df["start_datetime"].dt.month
    
    # Compute ECRS for each record
    def calc_ecrs(row):
        raw = compute_base_ecrs(
            event_cause=row.get("event_cause", "others"),
            corridor=row.get("corridor"),
            hour_of_day=row.get("hour_of_day"),
            requires_road_closure=row.get("requires_road_closure", False),
        )
        return normalize_ecrs(raw)
    
    # Handle requires_road_closure parsing
    df["requires_road_closure"] = df["requires_road_closure"].apply(
        lambda x: str(x).upper() in ("TRUE", "1", "YES") if pd.notna(x) else False
    )
    
    print("Computing ECRS scores...")
    df["ecrs_score"] = df.apply(calc_ecrs, axis=1)
    
    # Convert datetime columns to strings for SQLite
    for col in datetime_cols + ["effective_end"]:
        if col in df.columns:
            df[col] = df[col].astype(str).replace("NaT", None)
    
    # Select columns for the database
    db_columns = [
        "id", "event_type", "latitude", "longitude", "endlatitude", "endlongitude",
        "address", "end_address", "event_cause", "requires_road_closure",
        "start_datetime", "end_datetime", "status", "description",
        "veh_type", "corridor", "priority", "police_station",
        "resolved_at_latitude", "resolved_at_longitude",
        "closed_datetime", "resolved_datetime", "gba_identifier", "zone", "junction",
        "hour_of_day", "day_of_week", "month", "duration_minutes", "ecrs_score"
    ]
    
    # Only keep columns that exist
    db_columns = [c for c in db_columns if c in df.columns]
    df_db = df[db_columns].copy()
    
    # Replace pandas NA with None for SQLite
    df_db = df_db.where(pd.notnull(df_db), None)
    
    print("Writing to SQLite...")
    conn = get_connection()
    
    # Drop existing table if any
    conn.execute("DROP TABLE IF EXISTS incidents")
    conn.execute("DROP TABLE IF EXISTS hotspots")
    
    # Create incidents table
    df_db.to_sql("incidents", conn, if_exists="replace", index=False)
    
    # Create indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_zone ON incidents(zone)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_corridor ON incidents(corridor)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_event_cause ON incidents(event_cause)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_status ON incidents(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_priority ON incidents(priority)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_start_datetime ON incidents(start_datetime)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ecrs_score ON incidents(ecrs_score)")
    
    conn.commit()
    print(f"Loaded {len(df_db)} incidents into SQLite.")
    
    # Build hotspots table
    _build_hotspots_table(conn)
    
    print("Database initialization complete.")


def _ensure_hotspots_table(conn):
    """Ensure hotspots table exists."""
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='hotspots'")
    if not cursor.fetchone():
        _build_hotspots_table(conn)


def _build_hotspots_table(conn):
    """Build aggregated hotspot data from incidents."""
    print("Building hotspots table...")
    conn.execute("DROP TABLE IF EXISTS hotspots")
    
    conn.execute("""
        CREATE TABLE hotspots AS
        SELECT 
            COALESCE(junction, corridor) as location_name,
            junction,
            corridor,
            zone,
            COUNT(*) as incident_count,
            ROUND(AVG(ecrs_score), 2) as avg_ecrs,
            ROUND(AVG(duration_minutes), 1) as avg_duration,
            ROUND(AVG(latitude), 6) as avg_lat,
            ROUND(AVG(longitude), 6) as avg_lng,
            MAX(ecrs_score) as max_ecrs,
            SUM(CASE WHEN priority = 'High' THEN 1 ELSE 0 END) as high_priority_count,
            SUM(CASE WHEN requires_road_closure THEN 1 ELSE 0 END) as closure_count
        FROM incidents
        WHERE junction IS NOT NULL OR corridor != 'Non-corridor'
        GROUP BY COALESCE(junction, corridor)
        HAVING COUNT(*) >= 3
        ORDER BY incident_count DESC
    """)
    conn.commit()
    
    count = conn.execute("SELECT COUNT(*) FROM hotspots").fetchone()[0]
    print(f"Created {count} hotspot entries.")


def query_incidents(
    zone: Optional[str] = None,
    cause: Optional[str] = None,
    corridor: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[dict]:
    """Query incidents with filters."""
    conn = get_connection()
    
    query = "SELECT * FROM incidents WHERE 1=1"
    params = []
    
    if zone:
        query += " AND zone = ?"
        params.append(zone)
    if cause:
        query += " AND event_cause = ?"
        params.append(cause)
    if corridor:
        query += " AND corridor = ?"
        params.append(corridor)
    if status:
        query += " AND status = ?"
        params.append(status)
    if priority:
        query += " AND priority = ?"
        params.append(priority)
    if date_from:
        query += " AND start_datetime >= ?"
        params.append(date_from)
    if date_to:
        query += " AND start_datetime <= ?"
        params.append(date_to)
    
    query += " ORDER BY ecrs_score DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor = conn.execute(query, params)
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    
    return [dict(zip(columns, row)) for row in rows]


def get_active_incidents() -> List[dict]:
    """Get currently active incidents."""
    conn = get_connection()
    cursor = conn.execute(
        "SELECT * FROM incidents WHERE status = 'active' ORDER BY ecrs_score DESC"
    )
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def get_hotspots(limit: int = 20) -> List[dict]:
    """Get top hotspots by incident count."""
    conn = get_connection()
    cursor = conn.execute(
        "SELECT * FROM hotspots ORDER BY incident_count DESC LIMIT ?",
        [limit]
    )
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def get_stats() -> dict:
    """Compute dashboard statistics."""
    conn = get_connection()
    
    total = conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
    planned = conn.execute("SELECT COUNT(*) FROM incidents WHERE event_type = 'planned'").fetchone()[0]
    unplanned = conn.execute("SELECT COUNT(*) FROM incidents WHERE event_type = 'unplanned'").fetchone()[0]
    active = conn.execute("SELECT COUNT(*) FROM incidents WHERE status = 'active'").fetchone()[0]
    
    # Most common cause
    cause_row = conn.execute(
        "SELECT event_cause, COUNT(*) as cnt FROM incidents GROUP BY event_cause ORDER BY cnt DESC LIMIT 1"
    ).fetchone()
    
    # Highest-risk corridor
    corridor_row = conn.execute(
        "SELECT corridor, COUNT(*) as cnt FROM incidents WHERE corridor != 'Non-corridor' GROUP BY corridor ORDER BY cnt DESC LIMIT 1"
    ).fetchone()
    
    # Top zone
    zone_row = conn.execute(
        "SELECT zone, COUNT(*) as cnt FROM incidents WHERE zone IS NOT NULL GROUP BY zone ORDER BY cnt DESC LIMIT 1"
    ).fetchone()
    
    # Busiest police stations
    stations = conn.execute(
        "SELECT police_station, COUNT(*) as cnt FROM incidents WHERE police_station IS NOT NULL GROUP BY police_station ORDER BY cnt DESC LIMIT 5"
    ).fetchall()
    
    # Incident count by hour
    hours = conn.execute(
        "SELECT hour_of_day, COUNT(*) as cnt FROM incidents WHERE hour_of_day IS NOT NULL GROUP BY hour_of_day ORDER BY hour_of_day"
    ).fetchall()
    
    # Cause breakdown
    causes = conn.execute(
        "SELECT event_cause, COUNT(*) as cnt FROM incidents GROUP BY event_cause ORDER BY cnt DESC"
    ).fetchall()
    
    # Zone breakdown
    zones = conn.execute(
        "SELECT zone, COUNT(*) as cnt, ROUND(AVG(ecrs_score), 2) as avg_ecrs, MAX(ecrs_score) as max_ecrs FROM incidents WHERE zone IS NOT NULL GROUP BY zone ORDER BY cnt DESC"
    ).fetchall()
    
    # Corridor stats
    corridors = conn.execute(
        """SELECT corridor, COUNT(*) as cnt, ROUND(AVG(ecrs_score), 2) as avg_ecrs, 
           ROUND(AVG(duration_minutes), 1) as avg_duration, MAX(ecrs_score) as max_ecrs
           FROM incidents WHERE corridor != 'Non-corridor' 
           GROUP BY corridor ORDER BY cnt DESC"""
    ).fetchall()
    
    # Average ECRS
    avg_ecrs = conn.execute("SELECT ROUND(AVG(ecrs_score), 2) FROM incidents").fetchone()[0]
    
    # Event type breakdown
    event_types = conn.execute(
        "SELECT event_type, COUNT(*) as cnt FROM incidents GROUP BY event_type"
    ).fetchall()
    
    # Vehicle type breakdown
    vehicles = conn.execute(
        "SELECT veh_type, COUNT(*) as cnt FROM incidents WHERE veh_type IS NOT NULL GROUP BY veh_type ORDER BY cnt DESC"
    ).fetchall()
    
    # Priority breakdown
    priorities = conn.execute(
        "SELECT priority, COUNT(*) as cnt FROM incidents GROUP BY priority"
    ).fetchall()
    
    # Day of week breakdown
    days = conn.execute(
        "SELECT day_of_week, COUNT(*) as cnt FROM incidents WHERE day_of_week IS NOT NULL GROUP BY day_of_week ORDER BY day_of_week"
    ).fetchall()
    
    return {
        "total_incidents": total,
        "planned_events": planned,
        "unplanned_events": unplanned,
        "active_incidents": active,
        "planned_pct": round(planned / total * 100, 1) if total > 0 else 0,
        "unplanned_pct": round(unplanned / total * 100, 1) if total > 0 else 0,
        "most_common_cause": {"cause": cause_row[0], "count": cause_row[1]} if cause_row else None,
        "highest_risk_corridor": {"corridor": corridor_row[0], "count": corridor_row[1]} if corridor_row else None,
        "top_zone": {"zone": zone_row[0], "count": zone_row[1]} if zone_row else None,
        "busiest_stations": [{"station": r[0], "count": r[1]} for r in stations],
        "avg_ecrs": avg_ecrs,
        "hourly_distribution": [{"hour": r[0], "count": r[1]} for r in hours],
        "cause_breakdown": [{"cause": r[0], "count": r[1]} for r in causes],
        "zone_breakdown": [{"zone": r[0], "count": r[1], "avg_ecrs": r[2], "max_ecrs": r[3]} for r in zones],
        "corridor_stats": [{"corridor": r[0], "count": r[1], "avg_ecrs": r[2], "avg_duration": r[3], "max_ecrs": r[4]} for r in corridors],
        "event_type_breakdown": [{"type": r[0], "count": r[1]} for r in event_types],
        "vehicle_breakdown": [{"type": r[0], "count": r[1]} for r in vehicles],
        "priority_breakdown": [{"priority": r[0], "count": r[1]} for r in priorities],
        "day_of_week_distribution": [{"day": r[0], "count": r[1]} for r in days],
    }


def get_incident_by_id(incident_id: str) -> Optional[dict]:
    """Get a single incident by ID."""
    conn = get_connection()
    cursor = conn.execute("SELECT * FROM incidents WHERE id = ?", [incident_id])
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    if row:
        return dict(zip(columns, row))
    return None


def get_historical_stats_for_location(
    corridor: Optional[str] = None,
    junction: Optional[str] = None,
    event_cause: Optional[str] = None,
) -> dict:
    """Get historical statistics for a given location/cause combination."""
    conn = get_connection()
    
    conditions = []
    params = []
    
    if corridor and corridor != "Non-corridor":
        conditions.append("corridor = ?")
        params.append(corridor)
    if junction:
        conditions.append("junction = ?")
        params.append(junction)
    if event_cause:
        conditions.append("event_cause = ?")
        params.append(event_cause)
    
    where = " AND ".join(conditions) if conditions else "1=1"
    
    row = conn.execute(f"""
        SELECT 
            COUNT(*) as total,
            ROUND(AVG(duration_minutes), 1) as avg_duration,
            ROUND(AVG(ecrs_score), 2) as avg_ecrs,
            ROUND(MIN(duration_minutes), 1) as min_duration,
            ROUND(MAX(duration_minutes), 1) as max_duration
        FROM incidents WHERE {where}
    """, params).fetchone()
    
    return {
        "total_similar": row[0],
        "avg_duration": row[1],
        "avg_ecrs": row[2],
        "min_duration": row[3],
        "max_duration": row[4],
    }
