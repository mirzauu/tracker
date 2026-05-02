"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';

interface DayProgress {
  date: string;
  total: number;
  completed: number;
}

type ChartType = 'bar' | 'line';

export default function DailyProgressChart() {
  const [data, setData] = useState<DayProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const animationProgressRef = useRef(0);
  const prevChartTypeRef = useRef<ChartType>('bar');

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/calendar/progress');
      const json = await res.json();
      setData(json.progress || []);
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const getThemeColors = useCallback(() => {
    if (typeof window === 'undefined') return {
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      borderLight: '#f3f4f6',
      borderMedium: '#e5e7eb',
      colorGreen: '#10b981',
      colorGreenLight: '#d1fae5',
      bgColor: '#ffffff',
      hoverBg: '#f9fafb',
    };

    const style = getComputedStyle(document.documentElement);
    return {
      textPrimary: style.getPropertyValue('--text-primary').trim() || '#111827',
      textSecondary: style.getPropertyValue('--text-secondary').trim() || '#6b7280',
      borderLight: style.getPropertyValue('--border-light').trim() || '#f3f4f6',
      borderMedium: style.getPropertyValue('--border-medium').trim() || '#e5e7eb',
      colorGreen: style.getPropertyValue('--color-green').trim() || '#10b981',
      colorGreenLight: style.getPropertyValue('--color-green-light').trim() || '#d1fae5',
      bgColor: style.getPropertyValue('--bg-color').trim() || '#ffffff',
      hoverBg: style.getPropertyValue('--hover-bg').trim() || '#f9fafb',
    };
  }, []);

  const drawChart = useCallback((progress: number = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = 260;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const colors = getThemeColors();

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) {
      ctx.fillStyle = colors.textSecondary;
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No task data available yet', width / 2, height / 2);
      return;
    }

    const padding = { top: 30, right: 20, bottom: 50, left: 45 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxVal = Math.max(...data.map(d => Math.max(d.total, d.completed)), 1);
    const yMax = Math.ceil(maxVal / 5) * 5 || 5; // Round up to nearest 5

    // Draw grid lines
    const gridLines = 5;
    ctx.strokeStyle = colors.borderLight;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + chartHeight - (i / gridLines) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = colors.textSecondary;
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round((i / gridLines) * yMax)), padding.left - 8, y + 4);
    }
    ctx.setLineDash([]);

    const barGroupWidth = chartWidth / data.length;
    const today = new Date().toISOString().split('T')[0];

    if (chartType === 'bar') {
      // ─── BAR CHART ────────────────────────────────────────────
      const barWidth = Math.min(barGroupWidth * 0.35, 14);
      const gap = 3;

      data.forEach((day, i) => {
        const x = padding.left + i * barGroupWidth + barGroupWidth / 2;
        const isToday = day.date === today;
        const isHovered = hoveredIndex === i;

        // Total bar (background)
        const totalH = (day.total / yMax) * chartHeight * progress;
        const totalY = padding.top + chartHeight - totalH;

        // Glow effect for hovered bar
        if (isHovered && day.total > 0) {
          ctx.shadowColor = colors.colorGreen;
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        // Total bar
        ctx.fillStyle = isHovered ? colors.borderMedium : colors.borderLight;
        roundRect(ctx, x - barWidth - gap / 2, totalY, barWidth, totalH, 3);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Completed bar
        const completedH = (day.completed / yMax) * chartHeight * progress;
        const completedY = padding.top + chartHeight - completedH;
        
        const gradient = ctx.createLinearGradient(0, completedY, 0, completedY + completedH);
        gradient.addColorStop(0, colors.colorGreen);
        gradient.addColorStop(1, adjustAlpha(colors.colorGreen, 0.7));
        ctx.fillStyle = gradient;

        if (isHovered && day.completed > 0) {
          ctx.shadowColor = colors.colorGreen;
          ctx.shadowBlur = 8;
        }

        roundRect(ctx, x + gap / 2, completedY, barWidth, completedH, 3);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Today indicator dot
        if (isToday) {
          ctx.fillStyle = colors.colorGreen;
          ctx.beginPath();
          ctx.arc(x, padding.top + chartHeight + 20, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // X-axis labels (show every 5th day + first + last)
        if (i === 0 || i === data.length - 1 || (i + 1) % 5 === 0 || isToday) {
          ctx.fillStyle = isToday ? colors.colorGreen : colors.textSecondary;
          ctx.font = isToday ? 'bold 10px system-ui, -apple-system, sans-serif' : '10px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          const label = formatDateLabel(day.date);
          ctx.fillText(label, x, padding.top + chartHeight + 16);
        }

        // Hover tooltip
        if (isHovered) {
          drawTooltip(ctx, x, Math.min(totalY, completedY) - 10, day, colors, width);
        }
      });
    } else {
      // ─── LINE CHART ────────────────────────────────────────────
      const points: { x: number; y: number; totalY: number }[] = data.map((day, i) => ({
        x: padding.left + i * barGroupWidth + barGroupWidth / 2,
        y: padding.top + chartHeight - (day.completed / yMax) * chartHeight * progress,
        totalY: padding.top + chartHeight - (day.total / yMax) * chartHeight * progress,
      }));

      // Total line (dashed, subtle)
      ctx.strokeStyle = colors.borderMedium;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.totalY);
        else ctx.lineTo(p.x, p.totalY);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Completed area fill (gradient under the line)
      const areaGradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
      areaGradient.addColorStop(0, adjustAlpha(colors.colorGreen, 0.3));
      areaGradient.addColorStop(1, adjustAlpha(colors.colorGreen, 0.02));

      ctx.beginPath();
      ctx.moveTo(points[0].x, padding.top + chartHeight);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
      ctx.closePath();
      ctx.fillStyle = areaGradient;
      ctx.fill();

      // Completed line
      ctx.strokeStyle = colors.colorGreen;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Glow
      ctx.shadowColor = colors.colorGreen;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Data points
      points.forEach((p, i) => {
        const day = data[i];
        const isToday = day.date === today;
        const isHovered = hoveredIndex === i;

        // Total point (small, subtle)
        ctx.fillStyle = colors.borderMedium;
        ctx.beginPath();
        ctx.arc(p.x, p.totalY, isHovered ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Completed point
        ctx.fillStyle = colors.colorGreen;
        ctx.strokeStyle = colors.bgColor;
        ctx.lineWidth = 2;

        if (isHovered) {
          ctx.shadowColor = colors.colorGreen;
          ctx.shadowBlur = 10;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, isHovered ? 6 : (isToday ? 5 : 3.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Today indicator
        if (isToday) {
          ctx.fillStyle = colors.colorGreen;
          ctx.beginPath();
          ctx.arc(p.x, padding.top + chartHeight + 20, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // X-axis labels
        if (i === 0 || i === data.length - 1 || (i + 1) % 5 === 0 || isToday) {
          ctx.fillStyle = isToday ? colors.colorGreen : colors.textSecondary;
          ctx.font = isToday ? 'bold 10px system-ui, -apple-system, sans-serif' : '10px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(formatDateLabel(day.date), p.x, padding.top + chartHeight + 16);
        }

        // Hover tooltip
        if (isHovered) {
          drawTooltip(ctx, p.x, Math.min(p.y, p.totalY) - 10, day, colors, width);
        }
      });
    }
  }, [data, chartType, hoveredIndex, getThemeColors]);

  // Animate on mount and chart type change
  useEffect(() => {
    if (data.length === 0) return;

    animationProgressRef.current = 0;
    const startTime = performance.now();
    const duration = 600;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      animationProgressRef.current = eased;
      drawChart(eased);
      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    prevChartTypeRef.current = chartType;

    return () => cancelAnimationFrame(animationRef.current);
  }, [data, chartType, drawChart]);

  // Redraw on hover changes (no animation, just redraw at full)
  useEffect(() => {
    if (animationProgressRef.current >= 1) {
      drawChart(1);
    }
  }, [hoveredIndex, drawChart]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => drawChart(animationProgressRef.current >= 1 ? 1 : animationProgressRef.current);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawChart]);

  // Mouse interactions
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padding = { left: 45, right: 20 };
    const chartWidth = rect.width - padding.left - padding.right;
    const barGroupWidth = chartWidth / data.length;

    const index = Math.floor((mouseX - padding.left) / barGroupWidth);
    if (index >= 0 && index < data.length) {
      setHoveredIndex(index);
      canvas.style.cursor = 'crosshair';
    } else {
      setHoveredIndex(null);
      canvas.style.cursor = 'default';
    }
  }, [data]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  // Summary stats
  const totalTasks = data.reduce((sum, d) => sum + d.total, 0);
  const completedTasks = data.reduce((sum, d) => sum + d.completed, 0);
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const todayData = data.find(d => d.date === new Date().toISOString().split('T')[0]);

  if (loading) {
    return (
      <div style={{
        padding: '40px 24px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: '14px',
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '3px solid var(--border-light)',
          borderTop: '3px solid var(--color-green)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 12px',
        }} />
        Loading progress data...
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '24px',
      background: 'var(--bg-color)',
      border: '1px solid var(--border-medium)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            📊 Daily Task Progress
            <span style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              background: 'var(--hover-bg)',
              padding: '2px 8px',
              borderRadius: '10px',
            }}>
              30 days
            </span>
          </h3>
        </div>

        {/* Chart type toggle */}
        <div style={{
          display: 'flex',
          background: 'var(--hover-bg)',
          borderRadius: '8px',
          padding: '3px',
          gap: '2px',
        }}>
          <button
            onClick={() => setChartType('bar')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: chartType === 'bar' ? 'var(--color-green)' : 'transparent',
              color: chartType === 'bar' ? 'white' : 'var(--text-secondary)',
              boxShadow: chartType === 'bar' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            ▐▐ Bar
          </button>
          <button
            onClick={() => setChartType('line')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: chartType === 'line' ? 'var(--color-green)' : 'transparent',
              color: chartType === 'line' ? 'white' : 'var(--text-secondary)',
              boxShadow: chartType === 'line' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            📈 Line
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-light)',
        flexWrap: 'wrap',
      }}>
        <StatPill label="Total" value={totalTasks} color="var(--text-secondary)" bg="var(--hover-bg)" />
        <StatPill label="Completed" value={completedTasks} color="var(--color-green)" bg="var(--color-green-light)" />
        <StatPill label="Rate" value={`${completionRate}%`} color={completionRate >= 70 ? 'var(--color-green)' : 'var(--text-secondary)'} bg={completionRate >= 70 ? 'var(--color-green-light)' : 'var(--hover-bg)'} />
        {todayData && (
          <StatPill
            label="Today"
            value={`${todayData.completed}/${todayData.total}`}
            color="var(--color-green)"
            bg="var(--color-green-light)"
          />
        )}
      </div>

      {/* Chart */}
      <div ref={containerRef} style={{ padding: '12px 8px 8px' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ display: 'block', width: '100%' }}
        />
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        padding: '8px 20px 14px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '2px',
            background: 'var(--border-light)',
            border: '1px solid var(--border-medium)',
          }} />
          Total Tasks
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '2px',
            background: 'var(--color-green)',
          }} />
          Completed
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function StatPill({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 12px',
      borderRadius: '20px',
      background: bg,
      fontSize: '12px',
      fontWeight: 600,
    }}>
      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

// ─── Canvas Helpers ─────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return;
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function adjustAlpha(color: string, alpha: number): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  // Handle rgb/rgba
  if (color.startsWith('rgb')) {
    const match = color.match(/[\d.]+/g);
    if (match) {
      return `rgba(${match[0]},${match[1]},${match[2]},${alpha})`;
    }
  }
  return color;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.toLocaleString('default', { month: 'short' });
  return `${d.getDate()} ${month}`;
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  day: DayProgress,
  colors: Record<string, string>,
  canvasWidth: number
) {
  const date = new Date(day.date + 'T00:00:00');
  const dateLabel = date.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
  const line1 = dateLabel;
  const line2 = `${day.completed}/${day.total} completed`;

  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  const w1 = ctx.measureText(line1).width;
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  const w2 = ctx.measureText(line2).width;

  const tooltipW = Math.max(w1, w2) + 20;
  const tooltipH = 44;
  let tooltipX = x - tooltipW / 2;
  const tooltipY = Math.max(y - tooltipH - 8, 4);

  // Keep tooltip within bounds
  if (tooltipX < 4) tooltipX = 4;
  if (tooltipX + tooltipW > canvasWidth - 4) tooltipX = canvasWidth - tooltipW - 4;

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  // Background
  ctx.fillStyle = colors.bgColor || '#ffffff';
  roundRect(ctx, tooltipX, tooltipY, tooltipW, tooltipH, 8);
  ctx.fill();

  // Border
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = colors.borderMedium;
  ctx.lineWidth = 1;
  roundRect(ctx, tooltipX, tooltipY, tooltipW, tooltipH, 8);
  ctx.stroke();

  // Text
  ctx.fillStyle = colors.textPrimary;
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(line1, tooltipX + tooltipW / 2, tooltipY + 18);

  ctx.fillStyle = colors.colorGreen;
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  ctx.fillText(line2, tooltipX + tooltipW / 2, tooltipY + 34);
}
