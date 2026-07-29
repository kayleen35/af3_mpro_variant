import React from 'react';
import { CheckSquare, Square, Shield, Info } from 'lucide-react';
import type { Inhibitor } from '../../types/inhibitor';

export interface InhibitorCardProps {
  inhibitor: Inhibitor;
  selected?: boolean;
  onToggle?: (id: string) => void;
  selectable?: boolean;
  className?: string;
}

export const InhibitorCard: React.FC<InhibitorCardProps> = ({
  inhibitor,
  selected = false,
  onToggle,
  selectable = true,
  className = '',
}) => {
  const handleClick = () => {
    if (selectable && onToggle) {
      onToggle(inhibitor.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`card-base p-4 transition-all flex items-start justify-between gap-3 ${
        selectable ? 'cursor-pointer select-none card-hover' : ''
      } ${
        selected
          ? 'bg-[#141b2d] border-cyan-500/60 shadow-md '
          : 'bg-[#0b1020]/80 hover:bg-[#111827] opacity-80 hover:opacity-100'
      } ${className}`}
    >
      <div className="flex items-start gap-3 flex-1">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
            selected
              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
              : 'bg-[#141b2d] border-[#243047] text-gray-500'
          }`}
        >
          <Shield className="w-4 h-4 stroke-[2]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-gray-100 truncate">{inhibitor.name}</h4>
            <span className="text-[15px] px-2 py-0.5 rounded font-mono bg-violet-950/50 text-violet-300 border border-violet-500/30">
              Ligand
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
            {inhibitor.description || inhibitor.label}
          </p>

          {inhibitor.developmentStatusLabel && (
            <div className="mt-2.5 pt-2 border-t border-[#243047]/60 flex items-center gap-1.5 text-[15px] text-gray-500 font-mono">
              <Info className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">Stage: {inhibitor.developmentStatusLabel}</span>
            </div>
          )}
        </div>
      </div>

      {selectable && (
        <div className="pt-0.5 text-cyan-400 shrink-0">
          {selected ? (
            <CheckSquare className="w-5 h-5 stroke-[2]" />
          ) : (
            <Square className="w-5 h-5 text-gray-600 stroke-[1.5]" />
          )}
        </div>
      )}
    </div>
  );
};

export default InhibitorCard;
