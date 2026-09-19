import React from 'react';
import { CameraStatus } from '../../types/camera';

interface StatusBadgeProps {
  status: CameraStatus | string;
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showDot = true, className = '' }) => {
  const getStyles = () => {
    switch (status.toUpperCase()) {
      case 'HEALTHY':
      case 'ONLINE':
      case 'LIVE':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400 animate-pulse',
          label: 'ONLINE'
        };
      case 'DEGRADED':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-400',
          label: 'DEGRADED'
        };
      case 'CONNECTING':
        return {
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          dot: 'bg-blue-400 animate-ping',
          label: 'CONNECTING'
        };
      case 'OFFLINE':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          dot: 'bg-rose-400',
          label: 'OFFLINE'
        };
      case 'MAINTENANCE':
        return {
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          dot: 'bg-purple-400',
          label: 'MAINTENANCE'
        };
      case 'ERROR':
      default:
        return {
          bg: 'bg-red-500/10 text-red-400 border-red-500/30',
          dot: 'bg-red-400',
          label: status.toUpperCase()
        };
    }
  };

  const current = getStyles();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold tracking-wide border ${current.bg} ${className}`}
    >
      {showDot && <span className={`w-2 h-2 rounded-full ${current.dot}`} />}
      {current.label}
    </span>
  );
};
