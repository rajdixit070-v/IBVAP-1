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
          stroke: '#38bdf8', // Sky 400
          fill: 'rgba(56, 189, 248, 0.15)',
          badgeBg: '#0284c7',
          badgeText: '#ffffff'
        };
      case 'vehicle':
        return {
          stroke: '#34d399', // Emerald 400
          fill: 'rgba(52, 211, 153, 0.15)',
          badgeBg: '#059669',
          badgeText: '#ffffff'
        };
      case 'animal':
        return {
          stroke: '#fbbf24', // Amber 400
          fill: 'rgba(251, 191, 36, 0.15)',
          badgeBg: '#d97706',
          badgeText: '#ffffff'
        };
      case 'drone':
        return {
          stroke: '#c084fc', // Purple 400
          fill: 'rgba(192, 132, 252, 0.20)',
          badgeBg: '#9333ea',
          badgeText: '#ffffff'
        };
      default:
        return {
          stroke: '#94a3b8', // Slate 400
          fill: 'rgba(148, 163, 184, 0.15)',
          badgeBg: '#475569',
          badgeText: '#ffffff'
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

        const cornerLen = Math.min(bbox.width * 0.25, bbox.height * 0.25, 25);
        const top = bbox.y;
        const left = bbox.x;
        const right = bbox.x + bbox.width;
        const bottom = bbox.y + bbox.height;

        return (
          <g key={track_id} className="transition-all duration-75">
            {/* Trajectory Trail */}
            {showTrajectories && trajectory && trajectory.length > 1 && (
              <polyline
                points={trajectory.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={colors.stroke}
                strokeWidth="2.5"
                strokeDasharray="3, 3"
                opacity="0.75"
              />
            )}

            {/* Bounding Box Transparent Fill */}
            <rect
              x={left}
              y={top}
              width={bbox.width}
              height={bbox.height}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth="1.5"
              strokeDasharray="2, 2"
            />

            {/* Tactical Corner Reticles */}
            {/* Top-Left */}
            <path
              d={`M ${left} ${top + cornerLen} L ${left} ${top} L ${left + cornerLen} ${top}`}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="3.5"
            />
            {/* Top-Right */}
            <path
              d={`M ${right - cornerLen} ${top} L ${right} ${top} L ${right} ${top + cornerLen}`}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="3.5"
            />
            {/* Bottom-Left */}
            <path
              d={`M ${left} ${bottom - cornerLen} L ${left} ${bottom} L ${left + cornerLen} ${bottom}`}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="3.5"
            />
            {/* Bottom-Right */}
            <path
              d={`M ${right - cornerLen} ${bottom} L ${right} ${bottom} L ${right} ${bottom - cornerLen}`}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="3.5"
            />

            {/* Tactical Track Header Badge */}
            <rect
              x={left}
              y={Math.max(0, top - 26)}
              width={Math.max(130, object_type.length * 9 + 80)}
              height="24"
              fill={colors.badgeBg}
              rx="3"
            />
            <text
              x={left + 6}
              y={Math.max(16, top - 9)}
              fill={colors.badgeText}
              fontSize="12.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {object_type.toUpperCase()} #{track_id} • {Math.round(confidence * 100)}%
            </text>

            {/* Tactical Direction & Relative Speed Badge */}
            <rect
              x={left}
              y={bottom + 3}
              width={Math.max(120, direction.length * 8 + 65)}
              height="20"
              fill="#090d16"
              stroke={colors.stroke}
              strokeWidth="1"
              rx="3"
              opacity="0.9"
            />
            <text
              x={left + 5}
              y={bottom + 17}
              fill="#e2e8f0"
              fontSize="10.5"
              fontFamily="monospace"
              fontWeight="600"
            >
              DIR: {direction} • {Math.round(speed)} px/s
            </text>
          </g>
        );
      })}
    </svg>
  );
};
