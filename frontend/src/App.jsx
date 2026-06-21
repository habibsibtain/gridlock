import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PredictPanel from './components/PredictPanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import SimulatorPanel from './components/SimulatorPanel';
import EventCalendar from './components/EventCalendar';
import FeedbackPanel from './components/FeedbackPanel';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<PredictPanel />} />
          <Route path="/predict" element={<PredictPanel />} />
          <Route path="/simulator" element={<SimulatorPanel />} />
          <Route path="/events" element={<EventCalendar />} />
          <Route path="/feedback" element={<FeedbackPanel />} />
          <Route path="/ml-analytics" element={<AnalyticsDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
