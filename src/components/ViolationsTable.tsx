import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Violation } from '../types/database';
import { Search, Download, Filter, MoreHorizontal, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

export const ViolationsTable: React.FC = () => {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');

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

    if (!error && data) setViolations(data);
    setLoading(false);
  };

  // Module 6: Search and Filter Logic
  const filteredViolations = violations.filter(v => {
    const matchesSearch = v.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'All' || v.violation_type === filterType;
    return matchesSearch && matchesFilter;
  });

  // Module 6: Report Generation (CSV Export)
  const handleExport = () => {
    const headers = ['Vehicle Number', 'Vehicle Type', 'Violation Type', 'Date', 'Time', 'Speed (km/h)', 'Fine Amount', 'Status'];
    const csvData = filteredViolations.map(v => [
      v.vehicle_number,
      v.metadata?.class ? v.metadata.class.toUpperCase() : 'UNKNOWN',
      v.violation_type,
      new Date(v.created_at).toLocaleDateString(),
      new Date(v.created_at).toLocaleTimeString(),
      v.speed || 'N/A',
      v.fine_amount,
      v.status
    ].join(','));
    
    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Traffic_Violations_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Database Management</h3>
          <p className="text-sm text-slate-500">Search, filter, and export traffic violation records</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
            />
          </div>
          <div className="relative">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer"
            >
              <option value="All">All Violations</option>
              <option value="Signal Jump">Signal Jump</option>
              <option value="Overspeeding">Overspeeding</option>
              <option value="No Helmet">No Helmet</option>
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-md shadow-slate-900/10"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Vehicle</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Violation</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date & Time</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">Connecting to Database...</td>
              </tr>
            ) : filteredViolations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">No records found matching your criteria.</td>
              </tr>
            ) : (
              filteredViolations.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center font-mono font-bold text-slate-700 border border-slate-200 shadow-sm">
                        {v.vehicle_number.slice(-2)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 font-mono">{v.vehicle_number}</p>
                        <p className="text-xs text-slate-500 font-medium">{v.location}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-slate-600 uppercase bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {v.metadata?.class || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      v.violation_type === 'Overspeeding' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      v.violation_type === 'Signal Jump' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {v.violation_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-700">
                      {new Date(v.created_at).toLocaleDateString('en-IN')}
                    </p>
                    <p className="text-xs font-medium text-slate-400">
                      {new Date(v.created_at).toLocaleTimeString('en-IN')}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      v.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'Paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      {v.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {v.evidence_url ? (
                        <button 
                          onClick={() => {
                            const w = window.open();
                            w?.document.write(`<img src="${v.evidence_url}" style="max-width: 100%; height: auto;" />`);
                          }}
                          className="p-2 bg-slate-50 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg border border-slate-200 transition-all"
                          title="View Evidence"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">No Image</span>
                      )}
                      <button className="p-2 hover:bg-slate-100 text-slate-400 rounded-lg border border-transparent transition-all">
                        <MoreHorizontal className="w-4 h-4" />
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
