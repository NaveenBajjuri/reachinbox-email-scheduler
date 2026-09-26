import React from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  isLoading,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 py-4 px-6 border-b border-slate-100 bg-white">
      {/* Pill-shaped search bar matching Figma */}
      <div className="relative flex-1 max-w-xl">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search"
          className="w-full pl-10 pr-4 py-2 bg-[#F4F5F7] border border-transparent hover:border-slate-200 focus:border-[#00A854] focus:bg-white rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
        />
      </div>

      {/* Filter and Refresh Icons matching Figma */}
      <div className="flex items-center space-x-3 text-slate-400">
        <button
          type="button"
          className="p-2 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          title="Filter"
        >
          <Filter className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onRefresh}
          className="p-2 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00A854]' : ''}`} />
        </button>
      </div>
    </div>
  );
};
