import React from 'react';
import { RiskLevel } from '../../types/event';
import { ShieldAlert, AlertTriangle, ShieldCheck, Shield } from 'lucide-react';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  showIcon?: boolean;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  showIcon = true,
  className = ''
}) => {
  const getBadgeStyle = () => {
    switch (level) {
      case 'CRITICAL':
        return {
          bg: 'bg-rose-950/80 border-rose-500/50 text-rose-400',
          dot: 'bg-rose-400 animate-ping',
          icon: ShieldAlert
        };
      case 'HIGH':
        return {
          bg: 'bg-orange-950/80 border-orange-500/50 text-orange-400',
          dot: 'bg-orange-400',
          icon: AlertTriangle
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-950/80 border-amber-500/50 text-amber-400',
          dot: 'bg-amber-400',
          icon: Shield
        };
      case 'LOW':
      default:
        return {
          bg: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400',
          dot: 'bg-emerald-400',
          icon: ShieldCheck
        };
    }
  };

  const style = getBadgeStyle();
  const Icon = style.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded font-mono text-[11px] font-bold border ${style.bg} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${style.dot}`}></span>
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${style.dot.replace(' animate-ping', '')}`}></span>
      </span>

      {showIcon && <Icon className="w-3 h-3" />}
      <span>{level}</span>
      {score !== undefined && (
        <>
          <span className="text-slate-500">•</span>
          <span className="font-mono">{score}/100</span>
        </>
      )}
    </span>
  );
};
