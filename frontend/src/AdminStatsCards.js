import React from 'react';
import { Card, CardContent } from './components/ui/card';
import { Users, DollarSign, Package, ShoppingCart, Truck, AlertCircle } from 'lucide-react';

/**
 * 6-card stats grid for the Admin Overview tab.
 * Props: { stats: { total_users, total_orders, total_revenue, active_drivers, active_vendors, pending_verifications } }
 */
const AdminStatsCards = ({ stats }) => {
  if (!stats) return null;

  const items = [
    { label: 'Total Users', value: stats.total_users, Icon: Users, color: 'text-neon-cyan' },
    { label: 'Total Orders', value: stats.total_orders, Icon: Package, color: 'text-purple-600' },
    { label: 'Total Revenue', value: `$${(stats.total_revenue || 0).toFixed(0)}`, Icon: DollarSign, color: 'text-green-600' },
    { label: 'Active Drivers', value: stats.active_drivers, Icon: Truck, color: 'text-indigo-600' },
    { label: 'Active Vendors', value: stats.active_vendors, Icon: ShoppingCart, color: 'text-gold-500' },
    { label: 'Pending', value: stats.pending_verifications, Icon: AlertCircle, color: 'text-yellow-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {items.map(({ label, value, Icon, color }) => (
        <Card key={label}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold" data-testid={`admin-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
              </div>
              <Icon className={`h-8 w-8 ${color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminStatsCards;
