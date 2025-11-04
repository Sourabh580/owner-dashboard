import { useEffect, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  order?: any;
}

interface UseWebSocketProps {
  onNewOrder?: (order: any) => void;
  onOrderUpdated?: (order: any) => void;
}

export function useWebSocket({ onNewOrder, onOrderUpdated }: UseWebSocketProps = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    let isUnmounted = false;
    
    const connectWithUnmountGuard = () => {
      if (isUnmounted) return;
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          
          try {
            const message: WebSocketMessage = JSON.parse(event.data);

            if (message.type === 'NEW_ORDER' && message.order && onNewOrder) {
              onNewOrder(message.order);
            } else if (message.type === 'ORDER_UPDATED' && message.order && onOrderUpdated) {
              onOrderUpdated(message.order);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          if (!isUnmounted) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWithUnmountGuard();
            }, 3000);
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        if (!isUnmounted) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWithUnmountGuard();
          }, 3000);
        }
      }
    };

    connectWithUnmountGuard();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [onNewOrder, onOrderUpdated]);

  return wsRef;
}
