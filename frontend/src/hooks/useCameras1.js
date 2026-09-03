import { useState, useEffect, useCallback } from 'react';
import { getCameras } from '../services/api1';

export function useCameras() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCameras = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCameras();
      setCameras(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch cameras');
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  return { cameras, loading, error, refetch: fetchCameras };
}
