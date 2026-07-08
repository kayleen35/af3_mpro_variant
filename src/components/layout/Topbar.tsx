import React from 'react';
import { Link } from 'react-router-dom';
import { Download, ShieldCheck } from 'lucide-react';
import ResearchBadge from '../common/ResearchBadge';

export const Topbar: React.FC = () => {
  return (
    <header className="h-16 border-b border-[#243047] bg-[#0b1020]/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 shadow-md shadow-black/20">
      {/* Left: Project Brand / Title */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-300 bg-clip-text text-transparent">
              Mpro-Variant Binder
            </span>
            <span className="text-[10px] text-gray-400 font-mono -mt-1 tracking-wider uppercase">
              SARS-CoV-2 Structural Platform
            </span>
          </div>
        </Link>
      </div>

      {/* Right: Research Only Badge & Export Button */}
      <div className="flex items-center gap-4">
        <ResearchBadge />

        <div className="h-4 w-[1px] bg-[#243047] hidden sm:block" />

        <button
          type="button"
          disabled
          title="현재 준비 중인 기능입니다."
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#141b2d] border border-[#243047] text-gray-400 text-xs font-medium cursor-not-allowed opacity-60 hover:border-gray-600 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>보고서 내보내기 (준비중)</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
