import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { MapPin, Plus, Trash2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AdminServiceZones = () => {
  const [zones, setZones] = useState([]);
  const [zoneForm, setZoneForm] = useState({ name: '', polygon: '', allowed_services: '', description: '' });

  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API}/service-zones`, { headers: authHeaders() });
      setZones(res.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const createZone = async () => {
    let polygonParsed;
    try {
      polygonParsed = JSON.parse(zoneForm.polygon);
      if (!Array.isArray(polygonParsed) || polygonParsed.length < 3) throw new Error();
    } catch {
      alert('Polygon must be valid JSON like [[lat,lng],[lat,lng],[lat,lng],...] with 3+ points');
      return;
    }
    const services = zoneForm.allowed_services.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await axios.post(`${API}/service-zones`, {
        name: zoneForm.name,
        polygon: polygonParsed,
        allowed_services: services,
        active: true,
        description: zoneForm.description || undefined,
      }, { headers: authHeaders() });
      setZoneForm({ name: '', polygon: '', allowed_services: '', description: '' });
      fetchZones();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create zone');
    }
  };

  const deleteZone = async (id) => {
    if (!window.confirm('Delete this zone?')) return;
    try {
      await axios.delete(`${API}/service-zones/${id}`, { headers: authHeaders() });
      fetchZones();
    } catch (e) { alert(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-6" data-testid="admin-zones-content">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-gold-500" />Create Service Zone</CardTitle>
          <p className="text-sm text-muted-foreground">Define a polygon (3+ [lat,lng] points) to restrict operations to a specific geo region.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Zone Name</Label>
            <Input data-testid="zone-name-input" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="Port of Spain Central" />
          </div>
          <div>
            <Label>Polygon (JSON: [[lat,lng],[lat,lng],…])</Label>
            <Textarea data-testid="zone-polygon-input" value={zoneForm.polygon} onChange={(e) => setZoneForm({ ...zoneForm, polygon: e.target.value })} placeholder='[[10.6,-61.6],[10.7,-61.6],[10.7,-61.45],[10.6,-61.45]]' />
          </div>
          <div>
            <Label>Allowed Services (comma-separated)</Label>
            <Input data-testid="zone-services-input" value={zoneForm.allowed_services} onChange={(e) => setZoneForm({ ...zoneForm, allowed_services: e.target.value })} placeholder="food,taxi,grocery,pharmacy" />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input data-testid="zone-description-input" value={zoneForm.description} onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })} />
          </div>
          <Button data-testid="create-zone-btn" onClick={createZone} className="bg-gold-gradient text-white" disabled={!zoneForm.name || !zoneForm.polygon}>
            <Plus className="h-4 w-4 mr-2" />Create Zone
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-teal-700" />Active Zones ({zones.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <p className="text-center text-muted-foreground py-8" data-testid="zones-empty">No service zones defined yet.</p>
          ) : (
            <div className="space-y-2">
              {zones.map((z) => (
                <div key={z.id} className="flex items-center justify-between p-4 bg-matte-900/40 rounded-lg" data-testid={`zone-row-${z.id}`}>
                  <div>
                    <p className="font-medium">{z.name}</p>
                    <p className="text-sm text-muted-foreground">{z.country} • {z.polygon?.length || 0} vertices</p>
                    {z.allowed_services && z.allowed_services.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {z.allowed_services.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                      </div>
                    )}
                  </div>
                  <Button data-testid={`delete-zone-btn-${z.id}`} size="sm" variant="destructive" onClick={() => deleteZone(z.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminServiceZones;
