import React from 'react';
import { TrendingUp, Users, ShieldAlert, CreditCard } from 'lucide-react';

const stats = [
  { label: 'Total Violations', value: '1,284', change: '+12%', icon: ShieldAlert, color: 'blue' },
  { label: 'Active Cameras', value: '42', change: 'Stable', icon: Users, color: 'green' },
  { label: 'Fines Collected', value: '₹4.2L', change: '+8%', icon: CreditCard, color: 'purple' },
  { label: 'Detection Rate', value: '98.4%', change: '+2%', icon: TrendingUp, color: 'orange' },
];

export const StatsOverview: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
              stat.change.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-600'
            }`}>
              {stat.change}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
          <h4 className="text-2xl font-bold text-slate-900">{stat.value}</h4>
        </div>
      ))}
    </div>
  );
};
