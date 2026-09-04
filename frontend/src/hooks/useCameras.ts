import { useState, useEffect } from "react";
import { Camera } from "@/types";
import { apiGetCameras, apiGetCamera } from "@/services/api";

export const useCameras = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCameras = async () => {
    try {
      setLoading(true);
      const data = await apiGetCameras();
      setCameras(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cameras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  return { cameras, loading, error, refreshCameras: loadCameras };
};

export const useCamera = (cameraId: string | undefined) => {
  const [camera, setCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cameraId) return;

    const loadCamera = async () => {
      try {
        setLoading(true);
        const data = await apiGetCamera(cameraId);
        setCamera(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load camera");
      } finally {
        setLoading(false);
      }
    };

    loadCamera();
  }, [cameraId]);

  return { camera, loading, error };
};
