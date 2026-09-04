import { useEffect } from "react";
import { SecurityEvent } from "@/types";
import { wsService } from "@/services/websocket";

export const useWebSocket = (onEvent: (event: SecurityEvent) => void) => {
  useEffect(() => {
    let isSubscribed = true;

    const initWebSocket = async () => {
      try {
        await wsService.connect();
        if (isSubscribed) {
          wsService.subscribe(onEvent);
        }
      } catch (error) {
        console.error("WebSocket connection failed:", error);
      }
    };

    initWebSocket();

    return () => {
      isSubscribed = false;
      wsService.unsubscribe(onEvent);
    };
  }, [onEvent]);
};
