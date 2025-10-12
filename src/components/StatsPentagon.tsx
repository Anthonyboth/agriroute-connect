import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface StatItem {
  value: string;
  label: string;
}

interface StatsPentagonProps {
  items: StatItem[]; // expects 5 items in the order used on Landing.tsx
  heightClassName?: string; // optional override (default h-[520px])
}

export const StatsPentagon: React.FC<StatsPentagonProps> = ({ items, heightClassName = "h-[520px]" }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, []);

  const { points, pathD, labelPositions } = useMemo(() => {
    const w = size.w || 1;
    const h = size.h || 1;

    const cx = w / 2;
    const cy = h / 2;
    const padding = 24; // inner padding to keep contour away from edges
    const r = Math.max(10, Math.min(w, h) / 2 - padding);

    // Regular pentagon points (clockwise), starting at top (-90 deg)
    const pts: Array<{ x: number; y: number }> = [];
    const startDeg = -90;
    for (let i = 0; i < 5; i++) {
      const a = ((startDeg + i * 72) * Math.PI) / 180;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }

    const d = `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y} L ${pts[2].x},${pts[2].y} L ${pts[3].x},${pts[3].y} L ${pts[4].x},${pts[4].y} Z`;

    // Map Landing stats to vertices (keep same visual intent as before):
    // 0 -> top (pts[0])
    // 1 -> upper-left (pts[4])
    // 2 -> upper-right (pts[1])
    // 3 -> bottom-left (pts[3])
    // 4 -> bottom-right (pts[2])
    const map: number[] = [0, 4, 1, 3, 2];

    const offset = 36; // distance to place labels outside the polygon

    const pos = map.map((pi) => {
      const vx = pts[pi].x - cx;
      const vy = pts[pi].y - cy;
      const len = Math.max(1, Math.hypot(vx, vy));
      const nx = vx / len;
      const ny = vy / len;
      const extra = pi === 0 ? 8 : 0; // a little more space for the top
      return { x: pts[pi].x + (offset + extra) * nx, y: pts[pi].y + (offset + extra) * ny, idx: pi };
    });

    return { points: pts, pathD: d, labelPositions: pos };
  }, [size]);

  // Guard against wrong number of items
  const itemsSafe = items.length >= 5 ? items.slice(0, 5) : [
    { value: "0", label: "" },
    { value: "0", label: "" },
    { value: "0", label: "" },
    { value: "0", label: "" },
    { value: "0", label: "" },
  ];

  return (
    <div ref={containerRef} className={`hidden md:block relative ${heightClassName}`}>
      {/* SVG Regular Pentagon - uses currentColor via text-foreground */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none text-foreground"
        viewBox={`0 0 ${Math.max(1, size.w)} ${Math.max(1, size.h)}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ zIndex: 0 }}
      >
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          shapeRendering="geometricPrecision"
        />
      </svg>

      {/* Labels */}
      {labelPositions.map((p, i) => {
        // Align top item to center; others default left
        const isTop = p.idx === 0;
        const alignClass = isTop ? "-translate-x-1/2 text-center" : "";
        const style: React.CSSProperties = {
          position: "absolute",
          left: p.x,
          top: p.y,
          zIndex: 10,
        };
        return (
          <div key={i} className={`absolute ${alignClass}`} style={style}>
            <div className="text-3xl md:text-4xl font-extrabold text-primary mb-1">
              {itemsSafe[i].value}
            </div>
            <div className="text-sm md:text-base text-muted-foreground font-medium">
              {itemsSafe[i].label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsPentagon;
