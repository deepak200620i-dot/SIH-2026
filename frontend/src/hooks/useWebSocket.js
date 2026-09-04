import { useState, useEffect, useRef, useCallback } from 'react';
import WebSocketManager from '../services/websocket';

const MAX_EVENTS = 100;

export function useWebSocket() {
  const [status, setStatus] = useState('disconnected');
  const [events, setEvents] = useState([]);
  const managerRef = useRef(null);

  useEffect(() => {
    const manager = new WebSocketManager();
    managerRef.current = manager;

    const unsubStatus = manager.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    const unsubEvent = manager.onEvent((event) => {
      setEvents((prev) => {
        const updated = [event, ...prev];
        return updated.slice(0, MAX_EVENTS);
      });
    });

    manager.connect();

    return () => {
      unsubStatus();
      unsubEvent();
      manager.disconnect();
    };
  }, []);

  const isConnected = status === 'connected';

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { status, events, isConnected, clearEvents };
}
