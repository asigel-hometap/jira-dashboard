'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  dates?: string[];
  showTooltip?: boolean;
}

export default function Sparkline({ 
  data, 
  width = 120, 
  height = 30, 
  color = '#3B82F6',
  strokeWidth = 2,
  className = '',
  dates = [],
  showTooltip = false
}: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-400 text-xs ${className}`}>
        No data
      </div>
    );
  }

  // Create a simple SVG sparkline
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const normalizedData = data.map(value => 
    ((value - min) / range) * (height - 10) + 5
  );

  // Use a fixed width for calculations, but make SVG responsive
  const chartWidth = 400; // Fixed width for calculations
  const stepX = data.length > 1 ? (chartWidth - 10) / (data.length - 1) : 0;
  const pathData = normalizedData
    .map((y, index) => {
      const x = 5 + index * stepX;
      return `${index === 0 ? 'M' : 'L'} ${x} ${height - y}`;
    })
    .join(' ');

  return (
    <div className={`relative w-full ${className}`}>
      <div className="w-full" style={{ height: height }}>
        <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`} className="overflow-visible">
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {normalizedData.map((y, index) => (
            <circle
              key={index}
              cx={5 + index * stepX}
              cy={height - y}
              r="2"
              fill={color}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
