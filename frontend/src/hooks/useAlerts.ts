import { useState, useEffect } from "react";
import { Alert } from "@/types";
import { apiGetAlerts } from "@/services/api";

export const useAlerts = (filters?: any) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        setLoading(true);
        const data = await apiGetAlerts(1, 50, filters);
        setAlerts(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load alerts");
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, [filterKey]);

  return { alerts, loading, error };
};
