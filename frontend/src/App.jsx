import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SystemProvider } from './context/SystemContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import LiveCameras from './pages/LiveCameras';
import Alerts from './pages/Alerts';
import EventHistory from './pages/EventHistory';
import FenceConfig from './pages/FenceConfig';
import FaceGalleryPage from './pages/FaceGalleryPage';

export default function App() {
  return (
    <BrowserRouter>
      <SystemProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cameras" element={<LiveCameras />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/events" element={<EventHistory />} />
            <Route path="/fence" element={<FenceConfig />} />
            <Route path="/faces" element={<FaceGalleryPage />} />
          </Routes>
        </Layout>
      </SystemProvider>
    </BrowserRouter>
  );
}
