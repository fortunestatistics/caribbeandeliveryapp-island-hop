import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Trash2, AlertTriangle, ShieldCheck, Loader2, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const COLLECTION_LABELS = {
  restaurants: 'Restaurants',
  businesses: 'Business storefronts',
  car_rental_companies: 'Car rental companies',
  drivers: 'Drivers',
  business_applications: 'Applications',
  users: 'User accounts',
  orders: 'Orders',
};

const AdminDataCleanup = () => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const loadPreview = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.get(`${API}/admin/cleanup/preview`, { headers: authHeaders() });
      setPreview(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load cleanup preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPreview(); }, []);

  const runCleanup = async () => {
    const typed = window.prompt(
      `This permanently deletes ${preview?.total || 0} test records. ` +
      `Real applicants and "${(preview?.keep_restaurant || []).join(', ')}" are kept.\n\n` +
      `Type DELETE to confirm.`
    );
    if (typed !== 'DELETE') return;
    setExecuting(true);
    setError('');
    try {
      const res = await axios.post(`${API}/admin/cleanup/execute`, { confirm: 'DELETE' }, { headers: authHeaders() });
      setResult(res.data);
      await loadPreview();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Cleanup failed');
    } finally {
      setExecuting(false);
    }
  };

  const total = preview?.total || 0;

  return (
    <div className="space-y-6" data-testid="admin-cleanup-section">
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" /> Clean up test data
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Removes seeded/sample and test entries so only real applicants and information remain.
            Keeps <b>{(preview?.keep_restaurant || ['Caribbean Spice Kitchen']).join(', ')}</b> and every genuine sign-up.
            This is permanent.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadPreview} disabled={loading} data-testid="cleanup-refresh-btn">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh preview
            </Button>
            <Button
              onClick={runCleanup}
              disabled={executing || loading || total === 0}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="cleanup-execute-btn"
            >
              {executing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete {total} test records
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-600" data-testid="cleanup-error">{error}</p>
          )}

          {result && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4" data-testid="cleanup-result">
              <p className="flex items-center gap-2 text-green-700 font-medium">
                <ShieldCheck className="h-4 w-4" /> Cleanup complete — {result.total} records removed.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {Object.entries(result.deleted).map(([k, v]) => `${COLLECTION_LABELS[k] || k}: ${v}`).join(' · ')}
              </p>
            </div>
          )}

          {preview && (
            <div className="space-y-4" data-testid="cleanup-preview">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Will delete:</span>
                <Badge variant={total === 0 ? 'secondary' : 'destructive'} data-testid="cleanup-total">
                  {total} records
                </Badge>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(preview.summary || {}).map(([coll, data]) => (
                  <div key={coll} className="border border-border rounded-lg p-3" data-testid={`cleanup-group-${coll}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{COLLECTION_LABELS[coll] || coll}</span>
                      <Badge variant="outline">{data.count}</Badge>
                    </div>
                    {data.sample && data.sample.length > 0 && (
                      <ul className="mt-2 text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-auto">
                        {data.sample.map((name, i) => (
                          <li key={i} className="truncate">• {name || '(unnamed)'}</li>
                        ))}
                        {data.count > data.sample.length && (
                          <li className="italic">…and {data.count - data.sample.length} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDataCleanup;
