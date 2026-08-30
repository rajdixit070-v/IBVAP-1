import React, { useState, useRef } from 'react';
import { NormalizedPoint, SecurityZone } from '../../types/zone';
import { MousePointer, RotateCcw, Trash2 } from 'lucide-react';

interface ZoneDrawingCanvasProps {
  isDrawing: boolean;
  points: NormalizedPoint[];
  onPointsChange: (points: NormalizedPoint[]) => void;
  existingZones?: SecurityZone[];
  className?: string;
}

export const ZoneDrawingCanvas: React.FC<ZoneDrawingCanvasProps> = ({
  isDrawing,
  points,
  onPointsChange,
  existingZones = [],
  className = ''
}) => {
  const containerRef = useRef<SVGSVGElement>(null);
  const [cursorPos, setCursorPos] = useState<NormalizedPoint | null>(null);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const newPoint: NormalizedPoint = {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4))
    };

    onPointsChange([...points, newPoint]);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setCursorPos({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
  };

  const handleUndo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (points.length > 0) {
      onPointsChange(points.slice(0, -1));
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPointsChange([]);
  };

  const svgPointsString = points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');

  return (
    <div className={`absolute inset-0 w-full h-full ${isDrawing ? 'z-20' : 'z-10 pointer-events-none'} ${className}`}>
      <svg
        ref={containerRef}
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCursorPos(null)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={`w-full h-full ${isDrawing ? 'cursor-crosshair' : 'pointer-events-none'}`}
      >
        {/* Render Already Configured Security Zones */}
        {existingZones.map((zone) => {
          if (!zone.polygon || zone.polygon.length < 3) return null;
          const zonePointsStr = zone.polygon.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');
          let fillColor = 'rgba(244, 63, 94, 0.15)';
          let strokeColor = '#f43f5e';
          if (zone.zone_type === 'MONITORING') {
            fillColor = 'rgba(16, 185, 129, 0.15)';
            strokeColor = '#10b981';
          } else if (zone.zone_type === 'BUFFER') {
            fillColor = 'rgba(14, 165, 233, 0.15)';
            strokeColor = '#0ea5e9';
          } else if (zone.zone_type === 'HIGH_SECURITY') {
            fillColor = 'rgba(245, 158, 11, 0.15)';
            strokeColor = '#f59e0b';
          }

          const centerPoint = zone.polygon[0];

          return (
            <g key={zone.zone_id} opacity={zone.enabled ? 1.0 : 0.4}>
              <polygon
                points={zonePointsStr}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="0.5"
                strokeDasharray={zone.enabled ? 'none' : '1, 1'}
              />
              <text
                x={centerPoint.x * 100 + 1}
                y={centerPoint.y * 100 - 1}
                fontSize="2.2"
                fill={strokeColor}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {zone.name}
              </text>
            </g>
          );
        })}

        {/* Currently Drawing Closed Polygon Fill & Stroke if >= 3 points */}
        {points.length >= 3 && (
          <polygon
            points={svgPointsString}
            fill="rgba(56, 189, 248, 0.25)"
            stroke="#38bdf8"
            strokeWidth="0.8"
            strokeDasharray={isDrawing ? '1, 1' : 'none'}
          />
        )}

        {/* Lines between points if < 3 points */}
        {points.length < 3 && points.length > 1 && (
          <polyline
            points={svgPointsString}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="0.75"
            strokeDasharray="1, 1"
          />
        )}

        {/* Interactive Guide Line to Mouse Cursor while Drawing */}
        {isDrawing && cursorPos && points.length > 0 && (
          <line
            x1={points[points.length - 1].x * 100}
            y1={points[points.length - 1].y * 100}
            x2={cursorPos.x * 100}
            y2={cursorPos.y * 100}
            stroke="#38bdf8"
            strokeWidth="0.5"
            strokeDasharray="0.8, 0.8"
          />
        )}

        {/* Vertex Markers */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle
              cx={p.x * 100}
              cy={p.y * 100}
              r="1.2"
              fill="#38bdf8"
              stroke="#0f172a"
              strokeWidth="0.4"
            />
            <text
              x={p.x * 100 + 1.8}
              y={p.y * 100 + 1.2}
              fontSize="2.2"
              fill="#ffffff"
              fontFamily="monospace"
              fontWeight="bold"
            >
              P{idx + 1}
            </text>
          </g>
        ))}
      </svg>

      {/* Floating Drawing Control Overlay */}
      {isDrawing && (
        <div className="absolute bottom-4 left-4 z-30 bg-slate-950/90 border border-slate-700/80 backdrop-blur-md rounded-xl p-2.5 flex items-center gap-3 text-xs font-mono shadow-2xl">
          <div className="flex items-center gap-2 text-sky-400 font-bold">
            <MousePointer className="w-3.5 h-3.5" />
            <span>CLICK VIDEO TO PLACE VERTEX ({points.length} points)</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
            <button
              onClick={handleUndo}
              disabled={points.length === 0}
              className="p-1 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700 flex items-center gap-1 transition text-[11px]"
              title="Undo Point"
            >
              <RotateCcw className="w-3 h-3" /> Undo
            </button>
            <button
              onClick={handleClear}
              disabled={points.length === 0}
              className="p-1 px-2 bg-rose-950/60 hover:bg-rose-900/80 disabled:opacity-40 text-rose-300 rounded border border-rose-500/40 flex items-center gap-1 transition text-[11px]"
              title="Clear Points"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
