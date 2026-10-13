import React from 'react';
import { Card, CardContent } from './components/ui/card';
import { DollarSign, TrendingUp, Wallet, Clock } from 'lucide-react';
import { useCurrency } from './CurrencyContext';

/**
 * 4-stat cards row for driver earnings.
 * Props: { earnings: { today, week, balance, pending } }
 */
const DriverEarningsCards = ({ earnings }) => {
  const { format } = useCurrency();
  const cards = [
    {
      label: "Today's Earnings",
      value: earnings.today,
      icon: DollarSign,
      iconColor: 'text-gold-500',
      iconBg: 'bg-gold-500/15',
      valueColor: 'text-gold-500',
      testid: 'earnings-today',
    },
    {
      label: 'This Week',
      value: earnings.week,
      icon: TrendingUp,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100',
      valueColor: 'text-green-600',
      testid: 'earnings-week',
    },
    {
      label: 'Wallet Balance',
      value: earnings.balance,
      icon: Wallet,
      iconColor: 'text-teal-700',
      iconBg: 'bg-neon-cyan/15',
      valueColor: 'text-teal-700',
      testid: 'earnings-balance',
    },
    {
      label: 'Pending',
      value: earnings.pending,
      icon: Clock,
      iconColor: 'text-yellow-600',
      iconBg: 'bg-gold-500/15',
      valueColor: 'text-yellow-600',
      testid: 'earnings-pending',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {cards.map(({ label, value, icon: Icon, iconColor, iconBg, valueColor, testid }) => (
        <Card key={label}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`text-3xl font-bold ${valueColor}`} data-testid={testid}>
                  {format(value)}
                </p>
              </div>
              <div className={`${iconBg} p-3 rounded-lg`}>
                <Icon className={`h-6 w-6 ${iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DriverEarningsCards;
