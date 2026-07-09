import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { LiveFeed } from './components/LiveFeed';
import { ViolationsTable } from './components/ViolationsTable';
import { StatsOverview } from './components/StatsOverview';
import { Bell, Search, User } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search violations, vehicles or locations..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-10 w-[1px] bg-slate-200 mx-2" />
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">Admin Officer</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Traffic Dept</p>
              </div>
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <User className="w-6 h-6" />
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <>
              <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold text-slate-900">System Overview</h1>
                <p className="text-slate-500">Welcome back. Here is what's happening across the city today.</p>
              </div>
              <StatsOverview />
              <LiveFeed />
              <ViolationsTable />
            </>
          )}

          {activeTab === 'live' && (
            <div className="space-y-8">
              <LiveFeed />
            </div>
          )}

          {activeTab === 'violations' && (
            <div className="space-y-8">
              <ViolationsTable />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
              <p className="text-lg font-medium">Analytics visualization module coming soon...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
