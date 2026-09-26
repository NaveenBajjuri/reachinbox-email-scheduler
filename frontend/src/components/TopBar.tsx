import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, RefreshCw, Star, Check, ArrowDownUp, RotateCcw, Menu } from 'lucide-react';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  activeTab: 'scheduled' | 'sent';
  filterOption: 'all' | 'starred' | 'sent' | 'failed';
  onFilterChange: (opt: 'all' | 'starred' | 'sent' | 'failed') => void;
  sortOrder: 'newest' | 'oldest';
  onSortChange: (order: 'newest' | 'oldest') => void;
  onOpenMobileMenu?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  isLoading,
  activeTab,
  filterOption,
  onFilterChange,
  sortOrder,
  onSortChange,
  onOpenMobileMenu,
}) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    if (filterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterOpen]);

  const isFilterActive = filterOption !== 'all' || sortOrder !== 'newest';

  return (
    <div className="flex items-center justify-between gap-2.5 sm:gap-4 py-3 sm:py-4 px-4 sm:px-6 border-b border-slate-100 bg-white">
      {/* Mobile Hamburger Menu Toggle */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg md:hidden transition-colors cursor-pointer shrink-0"
        title="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Pill-shaped search bar matching Figma */}
      <div className="relative flex-1 max-w-xl">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by recipient, subject or content..."
          className="w-full pl-9 sm:pl-10 pr-4 py-2 bg-[#F4F5F7] border border-transparent hover:border-slate-200 focus:border-[#00A854] focus:bg-white rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
        />
      </div>

      {/* Filter and Refresh Icons matching Figma */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 text-slate-400 relative shrink-0" ref={filterRef}>
        {/* Filter Button */}
        <button
          type="button"
          onClick={() => setFilterOpen(!filterOpen)}
          className={`relative p-2 rounded-full transition-colors cursor-pointer ${
            isFilterActive || filterOpen
              ? 'bg-emerald-50 text-[#00A854] ring-1 ring-[#00A854]/40'
              : 'hover:bg-slate-100 hover:text-slate-600'
          }`}
          title="Filter and Sort"
        >
          <Filter className="w-4 h-4" />
          {isFilterActive && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00A854] ring-2 ring-white"></span>
          )}
        </button>

        {/* Filter & Sort Popover Dropdown */}
        {filterOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-32px)] bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="font-bold text-slate-900">Filter &amp; Sort</span>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={() => {
                    onFilterChange('all');
                    onSortChange('newest');
                  }}
                  className="text-[11px] text-[#00A854] hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Filter by Type */}
            <div className="space-y-1 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                Show
              </p>
              <button
                type="button"
                onClick={() => {
                  onFilterChange('all');
                  setFilterOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  filterOption === 'all'
                    ? 'bg-emerald-50 text-[#00A854] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>All {activeTab === 'scheduled' ? 'Scheduled' : 'Sent'}</span>
                {filterOption === 'all' && <Check className="w-3.5 h-3.5 text-[#00A854]" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  onFilterChange('starred');
                  setFilterOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  filterOption === 'starred'
                    ? 'bg-emerald-50 text-[#00A854] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>Starred Only</span>
                </div>
                {filterOption === 'starred' && <Check className="w-3.5 h-3.5 text-[#00A854]" />}
              </button>

              {activeTab === 'sent' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onFilterChange('sent');
                      setFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      filterOption === 'sent'
                        ? 'bg-emerald-50 text-[#00A854] font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Delivered Only</span>
                    {filterOption === 'sent' && <Check className="w-3.5 h-3.5 text-[#00A854]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onFilterChange('failed');
                      setFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      filterOption === 'failed'
                        ? 'bg-emerald-50 text-[#00A854] font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Failed Only</span>
                    {filterOption === 'failed' && <Check className="w-3.5 h-3.5 text-[#00A854]" />}
                  </button>
                </>
              )}
            </div>

            {/* Sort Order */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1 flex items-center space-x-1">
                <ArrowDownUp className="w-2.5 h-2.5" />
                <span>Sort By</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  onSortChange('newest');
                  setFilterOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  sortOrder === 'newest'
                    ? 'bg-emerald-50 text-[#00A854] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Newest first</span>
                {sortOrder === 'newest' && <Check className="w-3.5 h-3.5 text-[#00A854]" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSortChange('oldest');
                  setFilterOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  sortOrder === 'oldest'
                    ? 'bg-emerald-50 text-[#00A854] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Oldest first</span>
                {sortOrder === 'oldest' && <Check className="w-3.5 h-3.5 text-[#00A854]" />}
              </button>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          className="p-2 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          title="Refresh List"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00A854]' : ''}`} />
        </button>
      </div>
    </div>
  );
};
