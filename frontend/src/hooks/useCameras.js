import { useState, useEffect } from "react";
import { apiGetCameras, apiGetCamera } from "@/services/api";
export const useCameras = () => {
    const [cameras, setCameras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadCameras = async () => {
        try {
            setLoading(true);
            const data = await apiGetCameras();
            setCameras(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load cameras");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadCameras();
    }, []);
    return { cameras, loading, error, refreshCameras: loadCameras };
};
export const useCamera = (cameraId) => {
    const [camera, setCamera] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!cameraId)
            return;
        const loadCamera = async () => {
            try {
                setLoading(true);
                const data = await apiGetCamera(cameraId);
                setCamera(data);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load camera");
            }
            finally {
                setLoading(false);
            }
        };
        loadCamera();
    }, [cameraId]);
    return { camera, loading, error };
};
