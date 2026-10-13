import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Switch } from './components/ui/switch';
import { Clock, Save } from 'lucide-react';

const DAYS = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
  ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
];

const defaultDay = () => ({ open: '09:00', close: '17:00', closed: false });

const normalize = (value) => {
  const days = {};
  DAYS.forEach(([k]) => {
    const d = (value && value.days && value.days[k]) || {};
    days[k] = { open: d.open || '09:00', close: d.close || '17:00', closed: !!d.closed };
  });
  return { enabled: !!(value && value.enabled), days };
};

export const StoreHoursCard = ({ value, onSave, saving }) => {
  const [hours, setHours] = useState(() => normalize(value));

  const setDay = (key, patch) =>
    setHours((h) => ({ ...h, days: { ...h.days, [key]: { ...h.days[key], ...patch } } }));

  const copyMondayToAll = () => {
    const mon = hours.days.mon || defaultDay();
    setHours((h) => {
      const days = {};
      DAYS.forEach(([k]) => { days[k] = { ...mon }; });
      return { ...h, days };
    });
  };

  return (
    <Card className="mb-6" data-testid="store-hours-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-gold-500" /> Store Hours
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="font-medium text-sm">Enforce opening hours</p>
            <p className="text-xs text-muted-foreground">
              When on, customers can't place orders while your store is closed.
            </p>
          </div>
          <Switch
            checked={hours.enabled}
            onCheckedChange={(v) => setHours((h) => ({ ...h, enabled: v }))}
            data-testid="store-hours-enabled-toggle"
          />
        </div>

        <div className={hours.enabled ? '' : 'opacity-50 pointer-events-none'}>
          <div className="flex justify-end mb-2">
            <Button type="button" variant="ghost" size="sm" onClick={copyMondayToAll} data-testid="store-hours-copy-monday">
              Copy Monday to all days
            </Button>
          </div>
          <div className="space-y-2">
            {DAYS.map(([key, label]) => {
              const d = hours.days[key];
              return (
                <div key={key} className="flex items-center gap-3 flex-wrap" data-testid={`store-hours-row-${key}`}>
                  <div className="w-24 text-sm font-medium">{label}</div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={!d.closed}
                      onCheckedChange={(v) => setDay(key, { closed: !v })}
                      data-testid={`store-hours-open-toggle-${key}`}
                    />
                    {d.closed ? 'Closed' : 'Open'}
                  </label>
                  {!d.closed && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={d.open}
                        onChange={(e) => setDay(key, { open: e.target.value })}
                        className="w-32"
                        data-testid={`store-hours-open-${key}`}
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={d.close}
                        onChange={(e) => setDay(key, { close: e.target.value })}
                        className="w-32"
                        data-testid={`store-hours-close-${key}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Times are in your local time (Trinidad &amp; Tobago, AST).</p>
        </div>

        <Button
          onClick={() => onSave(hours)}
          disabled={saving}
          className="bg-gold-gradient text-white"
          data-testid="store-hours-save-btn"
        >
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save store hours'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default StoreHoursCard;
