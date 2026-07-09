import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, ShieldAlert, CreditCard, Cpu } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

export const StatsOverview: React.FC = () => {
  const [realStats, setRealStats] = useState({
    totalViolations: 0,
    totalFines: 0,
    todayViolations: 0
  });

  useEffect(() => {
    fetchRealStats();

    // Listen for new violations to update stats in real-time
    const subscription = supabase
      .channel('stats-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'violations' }, (payload) => {
        setRealStats(prev => ({
          totalViolations: prev.totalViolations + 1,
          todayViolations: prev.todayViolations + 1,
          totalFines: prev.totalFines + Number(payload.new.fine_amount || 0)
        }));
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchRealStats = async () => {
    const { data, error } = await supabase.from('violations').select('fine_amount, created_at');
    
    if (!error && data) {
      const today = new Date().toISOString().split('T')[0];
      let fines = 0;
      let todayCount = 0;

      data.forEach(v => {
        fines += Number(v.fine_amount || 0);
        if (v.created_at.startsWith(today)) {
          todayCount++;
        }
      });

      setRealStats({
        totalViolations: data.length,
        totalFines: fines,
        todayViolations: todayCount
      });
    }
  };

  const stats = [
    { 
      label: 'Total Violations', 
      value: realStats.totalViolations.toLocaleString(), 
      change: `+${realStats.todayViolations} Today`, 
      icon: ShieldAlert, 
      color: 'blue' 
    },
    { 
      label: 'Active Modules', 
      value: '5/5', 
      change: 'Optimal', 
      icon: Cpu, 
      color: 'green' 
    },
    { 
      label: 'Fines Recorded', 
      value: formatCurrency(realStats.totalFines), 
      change: 'Live DB', 
      icon: CreditCard, 
      color: 'purple' 
    },
    { 
      label: 'AI Accuracy', 
      value: '98.4%', 
      change: '+2%', 
      icon: TrendingUp, 
      color: 'orange' 
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className={cn(
              "p-3 rounded-2xl",
              stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
              stat.color === 'green' ? "bg-green-50 text-green-600" :
              stat.color === 'purple' ? "bg-purple-50 text-purple-600" :
              "bg-orange-50 text-orange-600"
            )}>
              <stat.icon className="w-6 h-6" />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
              stat.change.includes('+') || stat.change === 'Optimal' || stat.change === 'Live DB' 
                ? 'bg-green-50 text-green-600' 
                : 'bg-slate-50 text-slate-600'
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

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
