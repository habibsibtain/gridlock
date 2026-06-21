import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
/**
 * useGridlock — custom hook for CREST ML endpoints.
 * Exposes predict(), fetchAnalytics(), simulate(), submitFeedback(),
 * fetchFeedbackHistory(), fetchFeedbackStats(), and event management.
 */
export default function useGridlock() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const predict = useCallback(async (formData) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Prediction failed (${response.status}): ${text}`);
      }
      const data = await response.json();
      setResult(data);
      return data;
    } catch (err) {
      console.error('Predict error:', err);
      setError(err.message || 'Prediction failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/analytics`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Analytics fetch failed (${response.status}): ${text}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Analytics error:', err);
      setError(err.message || 'Analytics fetch failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const simulate = useCallback(async (scenarios) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarios }),
      });
      if (!response.ok) throw new Error('Simulation failed');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitFeedback = useCallback(async (feedbackData) => {
    try {
      const response = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });
      if (!response.ok) throw new Error('Feedback submission failed');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const fetchFeedbackHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/feedback/history`);
      if (!response.ok) throw new Error('Failed to fetch feedback');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const fetchFeedbackStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/feedback/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const createEvent = useCallback(async (eventData) => {
    try {
      const response = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) throw new Error('Failed to create event');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const fetchEvents = useCallback(async (date) => {
    try {
      const url = date ? `${API_BASE}/events?date=${date}` : `${API_BASE}/events`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch events');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const deleteEvent = useCallback(async (eventId) => {
    try {
      const response = await fetch(`${API_BASE}/events/${eventId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete event');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const checkConflicts = useCallback(async (checkData) => {
    try {
      const response = await fetch(`${API_BASE}/events/check-conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkData),
      });
      if (!response.ok) throw new Error('Failed to check conflicts');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  return {
    predict, fetchAnalytics, simulate,
    submitFeedback, fetchFeedbackHistory, fetchFeedbackStats,
    createEvent, fetchEvents, deleteEvent, checkConflicts,
    loading, result, error,
  };
}
