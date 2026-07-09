import React from 'react';
import { LayoutDashboard, Camera, History, Settings, ShieldAlert, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Camera, label: 'Live Monitoring', id: 'live' },
  { icon: ShieldAlert, label: 'Violations', id: 'violations' },
  { icon: BarChart3, label: 'Analytics', id: 'analytics' },
  { icon: History, label: 'History', id: 'history' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

interface SidebarProps {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col border-r border-slate-800">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <span className="font-bold text-xl tracking-tight">TrafficAI</span>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              activeTab === item.id 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-slate-300 uppercase">System Online</span>
          </div>
          <p className="text-[10px] text-slate-500">Node: Junction-01 (Main)</p>
        </div>
      </div>
    </div>
  );
};
