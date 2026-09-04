import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { LiveSurveillance } from "@/pages/LiveSurveillance";
import { Alerts } from "@/pages/Alerts";
import { Events } from "@/pages/Events";
import { FaceRecognition } from "@/pages/FaceRecognition";
import { ANPR } from "@/pages/ANPR";
import { Analytics } from "@/pages/Analytics";
import { Login } from "@/pages/Login";
import { useAlerts } from "@/hooks/useAlerts";
import { demoService } from "@/services/demoService";
import { DemoModeModal } from "@/components/modals/DemoModeModal";

// Placeholder pages
const Cameras = () => <div className="p-6"><h1 className="text-white">Cameras</h1></div>;
const Persons = () => <div className="p-6"><h1 className="text-white">Persons Database</h1></div>;
const Zones = () => <div className="p-6"><h1 className="text-white">Restricted Zones</h1></div>;
const Settings = () => <div className="p-6"><h1 className="text-white">Settings</h1></div>;

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const { alerts } = useAlerts();

  useEffect(() => {
    if (isDemoMode) {
      demoService.startDemo();
      return () => demoService.stopDemo();
    }
  }, [isDemoMode]);

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell isDemoMode={isDemoMode} alertCount={alerts.length} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/live" element={<LiveSurveillance />} />
          <Route path="/cameras" element={<Cameras />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/events" element={<Events />} />
          <Route path="/face-recognition" element={<FaceRecognition />} />
          <Route path="/persons" element={<Persons />} />
          <Route path="/anpr" element={<ANPR />} />
          <Route path="/zones" element={<Zones />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>
      </Routes>

      {/* Demo Mode Modal */}
      <DemoModeModal
        isActive={isDemoMode}
        onToggle={() => setIsDemoMode(!isDemoMode)}
      />
    </BrowserRouter>
  );
};

export default App;
