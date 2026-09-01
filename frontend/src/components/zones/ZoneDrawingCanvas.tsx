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

  const handleApplyPreset = (e: React.MouseEvent, presetType: 'bottom_half' | 'left_corridor' | 'right_corridor' | 'center_box') => {
    e.stopPropagation();
    if (presetType === 'bottom_half') {
      onPointsChange([
        { x: 0.05, y: 0.45 },
        { x: 0.95, y: 0.45 },
        { x: 0.95, y: 0.95 },
        { x: 0.05, y: 0.95 }
      ]);
    } else if (presetType === 'left_corridor') {
      onPointsChange([
        { x: 0.05, y: 0.10 },
        { x: 0.45, y: 0.10 },
        { x: 0.45, y: 0.95 },
        { x: 0.05, y: 0.95 }
      ]);
    } else if (presetType === 'right_corridor') {
      onPointsChange([
        { x: 0.55, y: 0.10 },
        { x: 0.95, y: 0.10 },
        { x: 0.95, y: 0.95 },
        { x: 0.55, y: 0.95 }
      ]);
    } else {
      onPointsChange([
        { x: 0.20, y: 0.20 },
        { x: 0.80, y: 0.20 },
        { x: 0.80, y: 0.80 },
        { x: 0.20, y: 0.80 }
      ]);
    }
  };

  const svgPointsString = points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');

  return (
    <div className={`absolute inset-0 w-full h-full ${isDrawing ? 'z-30 pointer-events-auto' : 'z-10 pointer-events-none'} ${className}`}>
      <svg
        ref={containerRef}
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCursorPos(null)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={`w-full h-full select-none ${isDrawing ? 'cursor-crosshair' : 'pointer-events-none'}`}
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
                strokeWidth="0.6"
                strokeDasharray={zone.enabled ? 'none' : '1, 1'}
              />
              <text
                x={centerPoint.x * 100 + 1}
                y={centerPoint.y * 100 - 1}
                fontSize="2.5"
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
            fill="rgba(56, 189, 248, 0.30)"
            stroke="#38bdf8"
            strokeWidth="0.9"
            strokeDasharray={isDrawing ? '1.5, 1' : 'none'}
          />
        )}

        {/* Lines between points if < 3 points */}
        {points.length < 3 && points.length > 1 && (
          <polyline
            points={svgPointsString}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="0.85"
            strokeDasharray="1.5, 1"
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
            strokeWidth="0.6"
            strokeDasharray="1, 1"
          />
        )}

        {/* Vertex Markers */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle
              cx={p.x * 100}
              cy={p.y * 100}
              r="1.6"
              fill="#38bdf8"
              stroke="#0f172a"
              strokeWidth="0.5"
            />
            <text
              x={p.x * 100 + 2.0}
              y={p.y * 100 + 1.2}
              fontSize="2.6"
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
        <div className="absolute bottom-3 left-3 right-3 z-40 bg-slate-950/95 border border-slate-700/90 backdrop-blur-lg rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-2xl">
          <div className="flex items-center gap-2 text-sky-400 font-bold">
            <MousePointer className="w-3.5 h-3.5 animate-bounce" />
            <span>Click video to place points ({points.length} vertices)</span>
          </div>

          {/* Quick Preset Templates */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Presets:</span>
            <button
              onClick={(e) => handleApplyPreset(e, 'bottom_half')}
              className="px-2 py-1 bg-slate-800 hover:bg-sky-700 text-slate-200 rounded text-[10px] border border-slate-700 transition cursor-pointer"
            >
              Bottom Half
            </button>
            <button
              onClick={(e) => handleApplyPreset(e, 'center_box')}
              className="px-2 py-1 bg-slate-800 hover:bg-sky-700 text-slate-200 rounded text-[10px] border border-slate-700 transition cursor-pointer"
            >
              Center Box
            </button>
            <button
              onClick={(e) => handleApplyPreset(e, 'left_corridor')}
              className="px-2 py-1 bg-slate-800 hover:bg-sky-700 text-slate-200 rounded text-[10px] border border-slate-700 transition cursor-pointer"
            >
              Left Flank
            </button>
            <button
              onClick={(e) => handleApplyPreset(e, 'right_corridor')}
              className="px-2 py-1 bg-slate-800 hover:bg-sky-700 text-slate-200 rounded text-[10px] border border-slate-700 transition cursor-pointer"
            >
              Right Flank
            </button>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
            <button
              onClick={handleUndo}
              disabled={points.length === 0}
              className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700 flex items-center gap-1 transition text-[11px] cursor-pointer"
              title="Undo Last Point"
            >
              <RotateCcw className="w-3 h-3" /> Undo
            </button>
            <button
              onClick={handleClear}
              disabled={points.length === 0}
              className="p-1 px-2.5 bg-rose-950/60 hover:bg-rose-900/80 disabled:opacity-40 text-rose-300 rounded border border-rose-500/40 flex items-center gap-1 transition text-[11px] cursor-pointer"
              title="Clear All Points"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
