import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import IncidentMap from '../components/Map/IncidentMap';
import ZoneSummaryBar from '../components/Dashboard/ZoneSummaryBar';
import AlertFeed from '../components/Dashboard/AlertFeed';
import CascadeSimulator from '../components/Dashboard/CascadeSimulator';
import MissionBrief from '../components/Dashboard/MissionBrief';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function DashboardPage() {
  const [incidents, setIncidents] = useState([]);
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [stats, setStats] = useState(null);
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [missionBrief, setMissionBrief] = useState(null);
  const [showMissionBrief, setShowMissionBrief] = useState(false);
  const [cascadeResult, setCascadeResult] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [incidentRes, activeRes, statsRes, poisRes] = await Promise.all([
        api.getIncidents({ limit: 500 }),
        api.getActive(),
        api.getStats(),
        api.getPois(),
      ]);
      setIncidents(incidentRes.incidents || []);
      setActiveIncidents(activeRes.incidents || []);
      setStats(statsRes);
      setPois(poisRes.pois || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGetRecommendation = async (incident) => {
    setSelectedIncident(incident);
    setShowMissionBrief(true);
    setMissionBrief(null);

    try {
      const result = await api.postRecommend({
        incident_id: incident.id,
        event_type: incident.event_type,
        cause: incident.event_cause,
        address: incident.address || 'Unknown',
        datetime: incident.start_datetime || '',
        priority: incident.priority || 'High',
        ecrs_score: incident.ecrs_score || 5,
        corridor: incident.corridor,
        zone: incident.zone,
      });
      setMissionBrief(result);
    } catch (err) {
      setMissionBrief({
        success: false,
        recommendation: 'Failed to generate recommendation. Please try again.',
        source: 'error',
      });
    }
  };

  const handleCascadeResult = (result) => {
    setCascadeResult(result);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner message="Loading ASTRAM Command Center..." />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Zone Summary Bar */}
      <ZoneSummaryBar stats={stats} />

      {/* Main Content: Map + Alert Feed */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map Area */}
        <div className="flex-1 relative flex flex-col">
          <div className="flex-1 p-3 pb-0">
            <IncidentMap
              incidents={incidents}
              activeIncidents={activeIncidents}
              pois={pois}
              cascadeResult={cascadeResult}
              onIncidentClick={setSelectedIncident}
            />
          </div>

          {/* Cascade Simulator */}
          <div className="p-3 pt-2">
            <CascadeSimulator onResult={handleCascadeResult} />
          </div>
        </div>

        {/* Alert Feed */}
        <div className="w-[380px] border-l border-glass-border flex flex-col overflow-hidden">
          <AlertFeed
            incidents={activeIncidents}
            onGetRecommendation={handleGetRecommendation}
          />
        </div>
      </div>

      {/* Mission Brief Modal */}
      {showMissionBrief && (
        <MissionBrief
          incident={selectedIncident}
          brief={missionBrief}
          onClose={() => {
            setShowMissionBrief(false);
            setMissionBrief(null);
          }}
        />
      )}
    </div>
  );
}
