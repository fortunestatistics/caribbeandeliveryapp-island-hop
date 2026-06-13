import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Bell, BellRing, BellOff } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const EnablePushButton = () => {
  const [state, setState] = useState('idle'); // idle | enabled | working | unsupported
  const supported = pushSupported();

  useEffect(() => {
    if (!supported) {
      setState('unsupported');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'enabled' : 'idle'))
      .catch(() => setState('idle'));
  }, [supported]);

  const enable = async () => {
    setState('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notifications were blocked. Enable them in your browser settings.');
        setState('idle');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const { data } = await axios.get(`${API}/push/vapid-public-key`);
      if (!data.public_key) {
        toast.error('Push notifications are not configured on the server.');
        setState('idle');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.public_key),
      });

      const token = localStorage.getItem('token');
      await axios.post(`${API}/push/subscribe`, sub.toJSON(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      setState('enabled');
      toast.success('Push notifications enabled — we\u2019ll alert you on order updates.');
    } catch (err) {
      console.error('Push enable failed', err);
      toast.error('Could not enable push notifications.');
      setState('idle');
    }
  };

  if (state === 'unsupported') {
    return (
      <Button variant="outline" size="sm" disabled data-testid="push-unsupported-btn">
        <BellOff className="h-4 w-4 mr-2" /> Push unavailable
      </Button>
    );
  }

  if (state === 'enabled') {
    return (
      <Button variant="outline" size="sm" disabled data-testid="push-enabled-btn">
        <BellRing className="h-4 w-4 mr-2 text-gold-500" /> Notifications on
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={enable}
      disabled={state === 'working'}
      data-testid="enable-push-btn"
    >
      <Bell className="h-4 w-4 mr-2" />
      {state === 'working' ? 'Enabling…' : 'Enable order alerts'}
    </Button>
  );
};

export default EnablePushButton;
