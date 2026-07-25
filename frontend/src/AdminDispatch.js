import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Radar, Truck, Package, Zap, Loader2, ArrowLeft, MapPin, Star, AlertTriangle } from 'lucide-react';
import { Switch } from './components/ui/switch';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDispatch = () => {
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [autoRun, setAutoRun] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/dispatch/board`, { withCredentials: true });
      setBoard(res.data);
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Failed to load dispatch board');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    axios.get(`${API}/admin/dispatch/settings`, { withCredentials: true })
      .then((r) => setAutoRun(!!r.data?.auto_run)).catch(() => {});
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const toggleAutoRun = async (val) => {
    setSavingAuto(true);
    setAutoRun(val);
    try {
      await axios.post(`${API}/admin/dispatch/settings`, { auto_run: val }, { withCredentials: true });
      setMsg(val ? 'Hands-free dispatch is ON — new orders will auto-assign to the best driver.' : 'Hands-free dispatch turned off.');
    } catch (e) {
      setAutoRun(!val);
      setMsg('Could not update auto-dispatch setting.');
    } finally {
      setSavingAuto(false);
    }
  };

  const runDispatch = async (orderId) => {
    setRunning(true); setMsg('');
    try {
      const res = await axios.post(`${API}/admin/dispatch/run`, orderId ? { order_id: orderId } : {}, { withCredentials: true });
      setMsg(`Dispatched ${res.data.dispatched} of ${res.data.processed} order(s).`);
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Dispatch failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0FA3A3' }} /></div>;
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="dispatch-back-btn">
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </button>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Radar className="h-7 w-7" style={{ color: '#0FA3A3' }} /> Courier Dispatch
            </h1>
            <p className="text-muted-foreground">Auto-assign the best available driver by proximity, rating &amp; subscription tier.</p>
          </div>
          <Button onClick={() => runDispatch(null)} disabled={running || (board?.unassigned_count || 0) === 0}
            className="text-white" style={{ background: '#0FA3A3' }} data-testid="dispatch-run-all-btn">
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
            Auto-dispatch all ({board?.unassigned_count || 0})
          </Button>
        </div>

        {msg && <div className="mb-4 text-sm rounded-lg bg-muted p-3" data-testid="dispatch-message">{msg}</div>}

        {/* Hands-free auto-dispatch */}
        <Card className="mb-6" data-testid="dispatch-autorun-card">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2.5" style={{ background: '#0FA3A315' }}>
                <Zap className="h-5 w-5" style={{ color: '#0FA3A3' }} />
              </div>
              <div>
                <p className="font-semibold text-foreground">Hands-free auto-dispatch</p>
                <p className="text-sm text-muted-foreground">When on, every new order is automatically assigned to the best available driver — no clicks needed.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${autoRun ? 'text-green-600' : 'text-muted-foreground'}`} data-testid="dispatch-autorun-state">
                {autoRun ? 'ON' : 'OFF'}
              </span>
              <Switch checked={autoRun} disabled={savingAuto} onCheckedChange={toggleAutoRun} data-testid="dispatch-autorun-switch" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unassigned orders */}
          <Card data-testid="dispatch-unassigned-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" style={{ color: '#F47B27' }} /> Unassigned orders ({board?.unassigned_count || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
              {(board?.unassigned_orders || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center" data-testid="dispatch-no-unassigned">All orders are assigned. 🎉</p>
              ) : board.unassigned_orders.map((o) => (
                <div key={o.id} className="rounded-lg border border-border p-3" data-testid={`dispatch-order-${o.id}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-sm">#{String(o.id).substring(0, 8)} · {o.service_type}</span>
                    <Badge variant="outline">{o.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3" /> {(o.delivery_address || {}).full_address || (o.delivery_address || {}).location || 'No address'}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    {o.has_pickup_coords ? (
                      <Button size="sm" variant="outline" onClick={() => runDispatch(o.id)} disabled={running} data-testid={`dispatch-order-btn-${o.id}`}>
                        <Zap className="h-3.5 w-3.5 mr-1" /> Dispatch
                      </Button>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> No pickup coordinates</span>
                    )}
                    <span className="text-sm font-semibold" style={{ color: '#0FA3A3' }}>${Number(o.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Online drivers */}
          <Card data-testid="dispatch-drivers-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Truck className="h-5 w-5" style={{ color: '#0FA3A3' }} /> Online drivers ({board?.online_driver_count || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
              {(board?.online_drivers || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center" data-testid="dispatch-no-drivers">No drivers online right now.</p>
              ) : board.online_drivers.map((d) => (
                <div key={d.id} className="rounded-lg border border-border p-3 flex items-center justify-between" data-testid={`dispatch-driver-${d.id}`}>
                  <div>
                    <p className="font-medium text-sm">{d.name || 'Driver'}</p>
                    <p className="text-xs text-muted-foreground">{d.vehicle_type || 'vehicle'} · {d.current_location ? 'located' : 'no live location'}</p>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500" /> {Number(d.rating || 0).toFixed(1)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDispatch;
