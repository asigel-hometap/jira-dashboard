'use client';

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SparklineProps {
  data: number[];
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  dates?: string[];
  showTooltip?: boolean;
  globalMaxProjects?: number;
}

// Custom tooltip component - memoized to prevent re-renders
const CustomTooltip = React.memo(({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const isOverloaded = value > 5;
    return (
      <div className="bg-white p-2 border border-gray-200 rounded shadow-lg text-xs">
        <p className="font-medium text-gray-900">{`Date: ${label}`}</p>
        <p className={isOverloaded ? 'text-red-600' : 'text-blue-600'}>
          Total Projects: {value}
        </p>
      </div>
    );
  }
  return null;
});
CustomTooltip.displayName = 'CustomTooltip';

const Sparkline = React.memo(({ 
  data, 
  height = 30, 
  color = '#3B82F6',
  strokeWidth = 2,
  className = '',
  dates = [],
  showTooltip = true,
  globalMaxProjects
}: SparklineProps) => {
  // Prepare data for Recharts - memoized to prevent unnecessary re-renders
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    return data.map((value, index) => ({
      value,
      date: dates[index] || `Week ${index + 1}`,
      index,
      // Color based on overload threshold: blue if <=5, red if >5
      color: value <= 5 ? '#3B82F6' : '#EF4444'
    }));
  }, [data, dates]);

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-400 text-xs ${className}`}>
        No data
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`} style={{ height: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <XAxis 
            dataKey="date" 
            hide 
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            hide 
            axisLine={false}
            tickLine={false}
            domain={[0, globalMaxProjects || 'dataMax + 1']}
          />
          {showTooltip && (
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
            />
          )}
          <Bar
            dataKey="value"
            radius={[2, 2, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
Sparkline.displayName = 'Sparkline';

export default Sparkline;
