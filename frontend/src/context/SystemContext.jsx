import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useCameras } from '../hooks/useCameras';
import { useStats } from '../hooks/useStats';
import { checkHealth } from '../services/api';
import { getHighestSeverity } from '../utils/formatters';

const SystemContext = createContext(null);

export function useSystem() {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
}

export function SystemProvider({ children }) {
  const [apiStatus, setApiStatus] = useState('checking');
  const { status: wsStatus, events: wsEvents, isConnected } = useWebSocket();
  const { cameras, loading: camerasLoading, error: camerasError } = useCameras();
  const { stats, loading: statsLoading, error: statsError } = useStats();

  // Check API health on mount and periodically
  useEffect(() => {
    let interval;

    const check = async () => {
      const healthy = await checkHealth();
      setApiStatus(healthy ? 'connected' : 'disconnected');
    };

    check();
    interval = setInterval(check, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Derive threat level from WebSocket events
  const threatLevel = getHighestSeverity(wsEvents);

  const value = {
    // API status
    apiStatus,

    // WebSocket
    wsStatus,
    wsEvents,
    isConnected,

    // Cameras
    cameras,
    camerasLoading,
    camerasError,

    // Stats
    stats,
    statsLoading,
    statsError,

    // Derived
    threatLevel,
  };

  return (
    <SystemContext.Provider value={value}>
      {children}
    </SystemContext.Provider>
  );
}
