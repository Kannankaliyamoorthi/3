import React from 'react';
import { cn } from '../lib/utils';

export type SignalState = 'red' | 'yellow' | 'green';

interface TrafficSignalProps {
  state: SignalState;
}

export const TrafficSignal: React.FC<TrafficSignalProps> = ({ state }) => {
  return (
    <div className="bg-slate-900 p-2 rounded-2xl flex flex-col gap-2 border border-slate-700 shadow-xl">
      <div className={cn(
        "w-6 h-6 rounded-full transition-all duration-300 shadow-inner",
        state === 'red' ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]" : "bg-red-950"
      )} />
      <div className={cn(
        "w-6 h-6 rounded-full transition-all duration-300 shadow-inner",
        state === 'yellow' ? "bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.8)]" : "bg-yellow-950"
      )} />
      <div className={cn(
        "w-6 h-6 rounded-full transition-all duration-300 shadow-inner",
        state === 'green' ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]" : "bg-green-950"
      )} />
    </div>
  );
};
