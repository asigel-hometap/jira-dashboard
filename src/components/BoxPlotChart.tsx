'use client';

import { useEffect, useRef, useState } from 'react';

interface BoxPlotData {
  quarter: string;
  data: number[];
  outliers: number[];
  size: number;
  stats: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
  };
}

interface BoxPlotChartProps {
  data: {
    cohorts: {
      [quarter: string]: BoxPlotData;
    };
  };
  unit: 'days' | 'weeks';
}

export default function BoxPlotChart({ data, unit }: BoxPlotChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [hoveredQuarter, setHoveredQuarter] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          setDimensions({
            width: container.clientWidth - 20, // Use full width with small padding
            height: 450 // Increased height for better spacing
          });
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !data.cohorts) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const quarters = Object.keys(data.cohorts).sort((a, b) => {
      // Sort quarters chronologically (Q3_2024, Q4_2024, Q1_2025, Q2_2025, Q3_2025, etc.)
      const [qA, yearA] = a.split('_');
      const [qB, yearB] = b.split('_');
      
      // Compare years first
      if (yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      }
      
      // If same year, compare quarters
      const quarterOrder = { 'Q1': 1, 'Q2': 2, 'Q3': 3, 'Q4': 4 };
      return quarterOrder[qA as keyof typeof quarterOrder] - quarterOrder[qB as keyof typeof quarterOrder];
    });
    if (quarters.length === 0) return;

    // Chart dimensions - increased margins for better spacing
    const margin = { top: 60, right: 60, bottom: 100, left: 100 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    // Find min and max values across all cohorts (excluding outliers for whisker calculation)
    let globalMin = Infinity;
    let globalMax = -Infinity;
    
    quarters.forEach(quarter => {
      const cohort = data.cohorts[quarter];
      if (cohort.size > 0) {
        // Only use the actual min/max from stats, not outliers
        globalMin = Math.min(globalMin, cohort.stats.min);
        globalMax = Math.max(globalMax, cohort.stats.max);
      }
    });

    if (globalMin === Infinity) return;

    // Add some padding
    const range = globalMax - globalMin;
    const padding = range * 0.1;
    globalMin -= padding;
    globalMax += padding;

    // Scale functions - add padding to prevent overlap with y-axis
    const xScale = (index: number) => margin.left + 60 + (index / (quarters.length - 1)) * (chartWidth - 120);
    const yScale = (value: number) => margin.top + chartHeight - ((value - globalMin) / (globalMax - globalMin)) * chartHeight;

    // Draw axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.fillStyle = '#6B7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const value = globalMin + (i / yTicks) * (globalMax - globalMin);
      const y = yScale(value);
      const displayValue = unit === 'weeks' ? Math.round(value / 7 * 10) / 10 : Math.round(value);
      ctx.fillText(displayValue.toString(), margin.left - 10, y);
    }

    // Draw X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    quarters.forEach((quarter, index) => {
      const x = xScale(index);
      const displayQuarter = quarter.replace('_2025', ' 2025');
      ctx.fillText(displayQuarter, x, margin.top + chartHeight + 20);
    });

    // Draw cohort counts below x-axis labels
    ctx.fillStyle = '#6B7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    quarters.forEach((quarter, index) => {
      const cohort = data.cohorts[quarter];
      const x = xScale(index);
      ctx.fillText(`n=${cohort.size}`, x, margin.top + chartHeight + 40);
    });

    // Draw box plots
    quarters.forEach((quarter, index) => {
      const cohort = data.cohorts[quarter];
      if (cohort.size === 0) return;

      const x = xScale(index);
      const boxWidth = 40;
      const halfBoxWidth = boxWidth / 2;

      // Box plot elements
      const q1Y = yScale(cohort.stats.q1);
      const medianY = yScale(cohort.stats.median);
      const q3Y = yScale(cohort.stats.q3);
      
      // Calculate whisker endpoints (Q1 - 1.5*IQR and Q3 + 1.5*IQR)
      const iqr = cohort.stats.q3 - cohort.stats.q1;
      const whiskerMin = Math.max(cohort.stats.min, cohort.stats.q1 - 1.5 * iqr);
      const whiskerMax = Math.min(cohort.stats.max, cohort.stats.q3 + 1.5 * iqr);
      const minY = yScale(whiskerMin);
      const maxY = yScale(whiskerMax);

      // Whiskers
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      
      // Lower whisker
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x, q1Y);
      ctx.stroke();

      // Upper whisker
      ctx.beginPath();
      ctx.moveTo(x, q3Y);
      ctx.lineTo(x, maxY);
      ctx.stroke();

      // Box
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(x - halfBoxWidth, q1Y, boxWidth, q3Y - q1Y);
      
      ctx.strokeStyle = '#1D4ED8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - halfBoxWidth, q1Y, boxWidth, q3Y - q1Y);

      // Median line
      ctx.strokeStyle = '#1E40AF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - halfBoxWidth, medianY);
      ctx.lineTo(x + halfBoxWidth, medianY);
      ctx.stroke();

      // Outliers
      if (cohort.outliers.length > 0) {
        ctx.fillStyle = '#EF4444';
        cohort.outliers.forEach(outlier => {
          const outlierY = yScale(outlier);
          ctx.beginPath();
          ctx.arc(x, outlierY, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      }

      // Remove the old cohort size label since we moved it below x-axis
    });

    // Chart title
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Discovery Cycle Time Analysis', dimensions.width / 2, 10);

    // Y-axis label
    ctx.save();
    ctx.translate(20, margin.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#6B7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Cycle Time (${unit})`, 0, 0);
    ctx.restore();

  }, [data, dimensions, unit]);

  // Mouse event handlers for interactivity
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setMousePosition({ x, y });
    
    // Check if mouse is over a box plot
    const quarters = Object.keys(data.cohorts).sort((a, b) => {
      // Sort quarters chronologically (Q3_2024, Q4_2024, Q1_2025, Q2_2025, Q3_2025, etc.)
      const [qA, yearA] = a.split('_');
      const [qB, yearB] = b.split('_');
      
      // Compare years first
      if (yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      }
      
      // If same year, compare quarters
      const quarterOrder = { 'Q1': 1, 'Q2': 2, 'Q3': 3, 'Q4': 4 };
      return quarterOrder[qA as keyof typeof quarterOrder] - quarterOrder[qB as keyof typeof quarterOrder];
    });
    const margin = { top: 60, right: 60, bottom: 100, left: 100 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;
    
    const xScale = (index: number) => margin.left + 60 + (index / (quarters.length - 1)) * (chartWidth - 120);
    const boxWidth = 40;
    
    let foundQuarter = null;
    quarters.forEach((quarter, index) => {
      const cohort = data.cohorts[quarter];
      if (cohort.size === 0) return;
      
      const quarterX = xScale(index);
      const halfBoxWidth = boxWidth / 2;
      
      if (x >= quarterX - halfBoxWidth && x <= quarterX + halfBoxWidth &&
          y >= margin.top && y <= margin.top + chartHeight) {
        foundQuarter = quarter;
      }
    });
    
    setHoveredQuarter(foundQuarter);
  };

  const handleMouseLeave = () => {
    setHoveredQuarter(null);
  };

  return (
    <div className="w-full relative">
      <canvas
        ref={canvasRef}
        className="border border-gray-200 rounded-lg cursor-pointer"
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Tooltip */}
      {hoveredQuarter && (
        <div
          className="absolute bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none z-10"
          style={{
            left: mousePosition.x + 10,
            top: mousePosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="font-semibold">{hoveredQuarter.replace('_2025', ' 2025')}</div>
          {(() => {
            const cohort = data.cohorts[hoveredQuarter];
            if (cohort.size === 0) return <div>No completed projects</div>;
            
            return (
              <div className="space-y-1">
                <div>Projects: {cohort.size}</div>
                <div>Median: {cohort.stats.median} {unit}</div>
                <div>1st Quartile: {cohort.stats.q1} {unit}</div>
                <div>3rd Quartile: {cohort.stats.q3} {unit}</div>
                {cohort.outliers.length > 0 && (
                  <div>Outliers: {cohort.outliers.length}</div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
