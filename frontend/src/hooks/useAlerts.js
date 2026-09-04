import { useState, useEffect } from "react";
import { apiGetAlerts } from "@/services/api";
export const useAlerts = (filters) => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const filterKey = JSON.stringify(filters);
    useEffect(() => {
        const loadAlerts = async () => {
            try {
                setLoading(true);
                const data = await apiGetAlerts(1, 50, filters);
                setAlerts(data.items);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load alerts");
            }
            finally {
                setLoading(false);
            }
        };
        loadAlerts();
    }, [filterKey]);
    return { alerts, loading, error };
};
