import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useToast } from './hooks/use-toast';
import { ToastAction } from './components/ui/toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Global listener: shows an in-app toast when a customer's order is rejected by a store.
const OrderNotifier = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const wsRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return undefined;

    let closed = false;
    let retry;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(BACKEND_URL.replace('http', 'ws') + `/ws/${user.id}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch (_) { return; }
        if (data.type !== 'order_rejected') return;
        const reason = data.reason || 'The store could not fulfill your order';
        const refunded = !!data.refunded;
        toast({
          title: 'Order declined by the store',
          description: `${reason}.${refunded ? ' Your payment has been refunded.' : ''}`,
          variant: 'destructive',
          duration: 12000,
          action: (
            <ToastAction
              altText="Find another store"
              data-testid="reject-toast-reorder"
              onClick={() => navigate('/businesses')}
            >
              Find another store
            </ToastAction>
          ),
        });
      };

      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 5000);
      };
      ws.onerror = () => { try { ws.close(); } catch (_) { /* noop */ } };
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (wsRef.current) { try { wsRef.current.close(); } catch (_) { /* noop */ } }
    };
  }, [user?.id, toast, navigate]);

  return null;
};

export default OrderNotifier;
