import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  variant?: 'default' | 'highlight' | 'warning';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-cyan-400',
  variant = 'default',
  className = '',
}) => {
  const bgClass =
    variant === 'highlight' ? 'bg-cyan-950/30 border-cyan-700/40' :
    variant === 'warning'   ? 'bg-amber-950/30 border-amber-700/40' :
    'bg-[#0b1020] border-[#243047]';

  const valueLength = String(value).length;
  const valueSizeClass = valueLength > 12 ? 'text-lg' : 'text-2xl';

  return (
    <div className={`card-base p-5 ${bgClass} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-gray-500 uppercase tracking-wider mb-1 truncate">
            {title}
          </p>
          <p className={`${valueSizeClass} font-bold text-gray-100 truncate`} title={String(value)}>{value}</p>
          {subtitle && (
            <p className="text-[15px] text-gray-500 mt-1 truncate">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl bg-white/5 shrink-0 ml-3`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
