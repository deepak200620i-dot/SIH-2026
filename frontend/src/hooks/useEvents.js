import { useState, useEffect } from "react";
import { apiGetEvents } from "@/services/api";
export const useEvents = (filters) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const filterKey = JSON.stringify(filters);
    useEffect(() => {
        const loadEvents = async () => {
            try {
                setLoading(true);
                const data = await apiGetEvents(page, 20, filters);
                setEvents(data.items);
                setHasMore(data.hasMore);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load events");
            }
            finally {
                setLoading(false);
            }
        };
        loadEvents();
    }, [filterKey, page]);
    return { events, loading, error, page, setPage, hasMore };
};
