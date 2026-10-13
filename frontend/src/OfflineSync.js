import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getQueue, removeFromQueue } from './offlineQueue';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Global manager: shows an offline / pending-sync banner and flushes queued
// orders to the server as soon as the connection returns.
const OfflineSyncManager = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(getQueue().length);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(0);

  const refreshCount = useCallback(() => setPending(getQueue().length), []);

  const flush = useCallback(async () => {
    const q = getQueue();
    if (q.length === 0 || !navigator.onLine || syncing) return;
    setSyncing(true);
    let sent = 0;
    for (const item of q) {
      const { _qid, _queued_at, ...payload } = item;
      try {
        await axios.post(`${API}/orders`, payload, { headers: authHeaders(), withCredentials: true });
        removeFromQueue(_qid);
        sent += 1;
      } catch (err) {
        if (!navigator.onLine || err?.code === 'ERR_NETWORK' || !err?.response) break; // still offline
        removeFromQueue(_qid); // permanent failure — drop so it doesn't loop forever
      }
    }
    setSyncing(false);
    refreshCount();
    if (sent > 0) {
      setJustSynced(sent);
      setTimeout(() => setJustSynced(0), 6000);
    }
  }, [syncing, refreshCount]);

  useEffect(() => {
    const onOnline = () => { setOnline(true); flush(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('islandhop-offline-queue-changed', refreshCount);
    flush(); // attempt on mount (covers reloads after reconnect)
    const t = setInterval(flush, 20000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('islandhop-offline-queue-changed', refreshCount);
      clearInterval(t);
    };
  }, [flush, refreshCount]);

  if (online && pending === 0 && justSynced === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
      style={{ background: online ? '#0FA3A3' : '#F47B27', color: 'white' }}
      data-testid="offline-sync-banner"
    >
      {justSynced > 0 ? (
        <><CheckCircle2 className="h-4 w-4" /> Synced {justSynced} order{justSynced > 1 ? 's' : ''}</>
      ) : !online ? (
        <><WifiOff className="h-4 w-4" /> Offline{pending > 0 ? ` — ${pending} order${pending > 1 ? 's' : ''} saved, will send when back online` : ''}</>
      ) : (
        <><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Syncing {pending} pending order{pending > 1 ? 's' : ''}…</>
      )}
    </div>
  );
};

export default OfflineSyncManager;
