import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Violation } from '../types/database';
import { Search, Download, Filter, MoreHorizontal, ExternalLink } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

export const ViolationsTable: React.FC = () => {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchViolations();

    const subscription = supabase
      .channel('violations-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'violations' }, (payload) => {
        setViolations((prev) => [payload.new as Violation, ...prev]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchViolations = async () => {
    const { data, error } = await supabase
      .from('violations')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setViolations(data);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Violation Records</h3>
          <p className="text-sm text-slate-500">Manage and review all detected traffic violations</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search vehicle..."
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Vehicle</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Violation</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date & Time</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Fine</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading records...</td>
              </tr>
            ) : violations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">No violations recorded yet.</td>
              </tr>
            ) : (
              violations.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-mono font-bold text-slate-600 border border-slate-200">
                        {v.vehicle_number.slice(-2)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{v.vehicle_number}</p>
                        <p className="text-xs text-slate-500">{v.location}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      v.violation_type === 'Overspeeding' ? 'bg-orange-100 text-orange-700' :
                      v.violation_type === 'Signal Jump' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {v.violation_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600">
                      {new Date(v.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(v.created_at).toLocaleTimeString()}
                    </p>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {formatCurrency(v.fine_amount)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      v.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'Paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      {v.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
                        <ExternalLink className="w-4 h-4 text-slate-400" />
                      </button>
                      <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
                        <MoreHorizontal className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
