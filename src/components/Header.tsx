import React from 'react';
import { Search, Store, Shield, ShieldCheck, X } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  warungCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  isAdmin,
  onOpenAdmin,
  warungCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E8DFD8] shadow-xs">
      <div className="max-w-4xl mx-auto px-4 pt-3 pb-3">
        {/* Brand bar */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center shadow-md shadow-red-600/25 border border-red-500/30 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black tracking-tight text-[#1F1612] leading-tight">
                KATALOG OLUMAJANG
              </h1>
              <p className="text-[11px] text-[#786C65] font-bold">
                Katalog Kuliner Lumajang ({warungCount} Warung)
              </p>
            </div>
          </div>

          {/* Admin Button (Thema Merah) */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAdmin}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shadow-xs ${
                isAdmin
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/25'
                  : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
              }`}
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-red-200" />
                  <span>PANEL ADMIN</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-red-600" />
                  <span>LOGIN ADMIN</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search bar - Tanpa filter kategori */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#948982]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari warung di Lumajang..."
            className="w-full pl-9 pr-9 py-2.5 bg-white border border-[#E8DFD8] rounded-2xl text-xs sm:text-sm text-[#1F1612] placeholder:text-[#A89D96] focus:outline-none focus:ring-2 focus:ring-red-600 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#948982] hover:text-[#1F1612]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
