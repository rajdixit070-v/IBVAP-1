import React from 'react';
import { TrackedObject } from '../../types/ai';
import { SecurityZone } from '../../types/zone';

interface DetectionOverlayProps {
  tracks: TrackedObject[];
  zones?: SecurityZone[];
  showTrajectories?: boolean;
  showZones?: boolean;
  className?: string;
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  tracks,
  zones = [],
  showTrajectories = true,
  showZones = true,
  className = ''
}) => {
  // Coordinate frame is normalized to 1920x1080 viewBox for SVG scaling
  const VIEW_WIDTH = 1920;
  const VIEW_HEIGHT = 1080;

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'person':
        return {
          stroke: '#ef4444', // High-Alert Tactical Red
          fill: 'rgba(239, 68, 68, 0.22)',
          badgeBg: '#dc2626',
          badgeText: '#ffffff',
          isThreat: true,
          labelPrefix: '🔴 UNKNOWN PERSON'
        };
      case 'vehicle':
        return {
          stroke: '#f59e0b', // High-Visibility Amber
          fill: 'rgba(245, 158, 11, 0.20)',
          badgeBg: '#d97706',
          badgeText: '#ffffff',
          isThreat: false,
          labelPrefix: '🟡 VEHICLE'
        };
      case 'animal':
        return {
          stroke: '#10b981', // Natural Emerald
          fill: 'rgba(16, 185, 129, 0.18)',
          badgeBg: '#059669',
          badgeText: '#ffffff',
          isThreat: false,
          labelPrefix: '🟢 ANIMAL'
        };
      case 'drone':
        return {
          stroke: '#06b6d4', // Aerial Cyan
          fill: 'rgba(6, 182, 212, 0.22)',
          badgeBg: '#0891b2',
          badgeText: '#ffffff',
          isThreat: true,
          labelPrefix: '🔵 AERIAL DRONE'
        };
      default:
        return {
          stroke: '#94a3b8', // Slate 400
          fill: 'rgba(148, 163, 184, 0.15)',
          badgeBg: '#475569',
          badgeText: '#ffffff',
          isThreat: false,
          labelPrefix: 'TARGET'
        };
    }
  };

  const getZoneStyle = (zoneType: string) => {
    switch (zoneType.toUpperCase()) {
      case 'RESTRICTED':
        return {
          fill: 'rgba(225, 29, 72, 0.22)',
          stroke: '#f43f5e',
          text: '#fda4af',
          badge: '#be123c'
        };
      case 'HIGH_SECURITY':
        return {
          fill: 'rgba(249, 115, 22, 0.22)',
          stroke: '#f97316',
          text: '#fed7aa',
          badge: '#c2410c'
        };
      case 'BUFFER':
        return {
          fill: 'rgba(245, 158, 11, 0.15)',
          stroke: '#f59e0b',
          text: '#fde68a',
          badge: '#b45309'
        };
      case 'MONITORING':
      default:
        return {
          fill: 'rgba(6, 182, 212, 0.15)',
          stroke: '#06b6d4',
          text: '#a5f3fc',
          badge: '#0e7490'
        };
    }
  };

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className={`absolute inset-0 w-full h-full pointer-events-none select-none ${className}`}
    >
      {/* 1. Render Virtual Security Zones */}
      {showZones &&
        zones
          .filter((z) => z.enabled)
          .map((zone) => {
            const style = getZoneStyle(zone.zone_type);
            const pointsString = zone.polygon
              .map((p) => `${p.x * VIEW_WIDTH},${p.y * VIEW_HEIGHT}`)
              .join(' ');

            const firstPt = zone.polygon[0] || { x: 0.1, y: 0.1 };

            return (
              <g key={zone.zone_id}>
                {/* Zone Polygon */}
                <polygon
                  points={pointsString}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="3.5"
                  strokeDasharray="6, 4"
                />

                {/* Tactical Zone Label Tag */}
                <rect
                  x={firstPt.x * VIEW_WIDTH + 8}
                  y={firstPt.y * VIEW_HEIGHT + 8}
                  width={zone.name.length * 10 + 120}
                  height="26"
                  fill={style.badge}
                  rx="4"
                  opacity="0.9"
                />
                <text
                  x={firstPt.x * VIEW_WIDTH + 14}
                  y={firstPt.y * VIEW_HEIGHT + 26}
                  fontSize="13"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#ffffff"
                >
                  [{zone.zone_type}] {zone.name}
                </text>
              </g>
            );
          })}

      {/* 2. Render Tracked Objects & Bounding Boxes */}
      {tracks.map((track) => {
        const { bbox, track_id, object_type, category, confidence, direction, speed, trajectory } = track;
        const colors = getCategoryColor(category);

        const isNormalized = bbox.x <= 1.05 && bbox.y <= 1.05 && bbox.width <= 1.05;
        const left = isNormalized ? bbox.x * VIEW_WIDTH : bbox.x;
        const top = isNormalized ? bbox.y * VIEW_HEIGHT : bbox.y;
        const width = isNormalized ? bbox.width * VIEW_WIDTH : bbox.width;
        const height = isNormalized ? bbox.height * VIEW_HEIGHT : bbox.height;
        const right = left + width;
        const bottom = top + height;
        const cx = left + width / 2;
        const cy = top + height / 2;
        const cornerLen = Math.min(width * 0.25, height * 0.25, 30);

        return (
          <g key={track_id} className="transition-all duration-75">
            {/* Trajectory Trail */}
            {showTrajectories && trajectory && trajectory.length > 1 && (
              <polyline
                points={trajectory
                  .map((p) => {
                    const px = isNormalized ? p.x * VIEW_WIDTH : p.x;
                    const py = isNormalized ? p.y * VIEW_HEIGHT : p.y;
                    return `${px},${py}`;
                  })
                  .join(' ')}
                fill="none"
                stroke={colors.stroke}
                strokeWidth="2.5"
                strokeDasharray="4, 3"
                opacity="0.8"
              />
            )}

            {/* Bounding Box Transparent Fill */}
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth="2"
              strokeDasharray={colors.isThreat ? 'none' : '4, 2'}
            />

            {/* Tactical Corner Reticles */}
            {/* Top-Left */}
            <path
              d={`M ${left} ${top + cornerLen} L ${left} ${top} L ${left + cornerLen} ${top}`}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="4"
            />
            {/* Top-Right */}
            <path
              d={`M ${right - cornerLen} ${top} L ${right} ${top} L ${right} ${top + cornerLen}`}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="4"
            />
            {/* Bottom-Left */}
            <path
              d={`M ${left} ${bottom - cornerLen} L ${left} ${bottom} L ${left + cornerLen} ${bottom}`}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="4"
            />
            {/* Bottom-Right */}
            <path
              d={`M ${right - cornerLen} ${bottom} L ${right} ${bottom} L ${right} ${bottom - cornerLen}`}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="4"
            />

            {/* Center Tactical Crosshair Point Reticle */}
            <circle
              cx={cx}
              cy={cy}
              r="12"
              fill="none"
              stroke={colors.stroke}
              strokeWidth="2"
              strokeDasharray="4, 3"
              opacity="0.85"
            />
            <line x1={cx - 18} y1={cy} x2={cx - 5} y2={cy} stroke={colors.stroke} strokeWidth="2" />
            <line x1={cx + 5} y1={cy} x2={cx + 18} y2={cy} stroke={colors.stroke} strokeWidth="2" />
            <line x1={cx} y1={cy - 18} x2={cx} y2={cy - 5} stroke={colors.stroke} strokeWidth="2" />
            <line x1={cx} y1={cy + 5} x2={cx} y2={cy + 18} stroke={colors.stroke} strokeWidth="2" />
            <circle cx={cx} cy={cy} r="3" fill={colors.stroke} />

            {/* Top Target Pinpoint Arrow Marker */}
            <polygon
              points={`${cx},${Math.max(0, top - 3)} ${cx - 7},${Math.max(0, top - 15)} ${cx + 7},${Math.max(0, top - 15)}`}
              fill={colors.stroke}
            />

            {/* Ground Plane Contact Beacon Point */}
            <ellipse
              cx={cx}
              cy={bottom}
              rx={Math.max(16, width * 0.35)}
              ry="6"
              fill="none"
              stroke={colors.stroke}
              strokeWidth="2"
              opacity="0.75"
            />
            <circle cx={cx} cy={bottom} r="3.5" fill={colors.stroke} />

            {/* Tactical Track Header Badge */}
            <rect
              x={left}
              y={Math.max(0, top - 28)}
              width={Math.max(140, (colors.labelPrefix?.length || 8) * 9 + 80)}
              height="26"
              fill={colors.badgeBg}
              rx="4"
              stroke={colors.stroke}
              strokeWidth="1"
            />
            <text
              x={left + 7}
              y={Math.max(18, top - 10)}
              fill={colors.badgeText}
              fontSize="12.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {colors.labelPrefix || object_type.toUpperCase()} #{track_id} • {Math.round(confidence * 100)}%
            </text>

            {/* Tactical Direction & Relative Speed Badge */}
            <rect
              x={left}
              y={bottom + 8}
              width={Math.max(120, (direction || '').length * 8 + 65)}
              height="20"
              fill="#090d16"
              stroke={colors.stroke}
              strokeWidth="1"
              rx="3"
              opacity="0.9"
            />
            <text
              x={left + 5}
              y={bottom + 22}
              fill="#e2e8f0"
              fontSize="10.5"
              fontFamily="monospace"
              fontWeight="600"
            >
              DIR: {direction || 'STATIONARY'} • {Math.round(speed || 0)} px/s
            </text>
          </g>
        );
      })}
    </svg>
  );
};
