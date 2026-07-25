// Offline order queue for rural T&T — when the network drops, orders are stored
// locally and auto-sent the moment connectivity returns.
const KEY = 'islandhop_offline_orders_v1';

export const getQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch (_) {
    return [];
  }
};

const save = (q) => {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (_) { /* storage full */ }
  window.dispatchEvent(new Event('islandhop-offline-queue-changed'));
};

export const enqueueOrders = (payloads) => {
  const q = getQueue();
  const stamped = payloads.map((p) => ({
    ...p,
    _qid: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    _queued_at: new Date().toISOString(),
  }));
  save([...q, ...stamped]);
  return stamped;
};

export const removeFromQueue = (qid) => {
  save(getQueue().filter((o) => o._qid !== qid));
};

export const queueCount = () => getQueue().length;

// A dropped-network error (no HTTP response) rather than a server rejection.
export const isNetworkError = (err) =>
  !navigator.onLine || err?.code === 'ERR_NETWORK' || err?.message === 'Network Error' || !err?.response;
