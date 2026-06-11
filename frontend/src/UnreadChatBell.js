import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell } from 'lucide-react';
import { Badge } from './components/ui/badge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const POLL_MS = 15000;

/**
 * Header bell that polls the unread-summary endpoint. Shows a red badge with
 * the total unread message count across all the user's active orders. Tapping
 * navigates to the user's first unread order (best-effort) or their dashboard.
 */
const UnreadChatBell = () => {
  const [unread, setUnread] = useState(0);
  const [firstOrderId, setFirstOrderId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let token;
    try { token = localStorage.getItem('token'); } catch (_e) { token = null; }
    if (!token) return undefined;

    const headers = { Authorization: `Bearer ${token}` };
    const fetchSummary = async () => {
      try {
        const r = await axios.get(`${API}/chat/unread/summary`, { headers });
        const data = r.data || {};
        setUnread(data.unread_total || 0);
        const first = (data.orders_with_unread || [])[0];
        setFirstOrderId(first?.order_id || null);
      } catch (err) {
        // 401/403 -> user logged out; quietly stop
        if (![401, 403].includes(err.response?.status)) {
          console.error('unread summary failed:', err);
        }
      }
    };
    fetchSummary();
    const id = setInterval(fetchSummary, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const handleClick = () => {
    if (firstOrderId) {
      navigate(`/order/${firstOrderId}`);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${unread} unread messages`}
      data-testid="unread-chat-bell"
      className="relative p-2 rounded-lg hover:bg-matte-800/60 transition-colors"
    >
      <Bell className={`h-5 w-5 ${unread > 0 ? 'text-gold-500' : 'text-muted-foreground'}`} />
      {unread > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 text-[10px] flex items-center justify-center"
          data-testid="unread-chat-count"
        >
          {unread > 99 ? '99+' : unread}
        </Badge>
      )}
    </button>
  );
};

export default UnreadChatBell;
