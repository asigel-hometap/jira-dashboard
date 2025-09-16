'use client';

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
    return (
      <div className="bg-white p-2 border border-gray-200 rounded shadow-lg text-xs">
        <p className="font-medium text-gray-900">{`Date: ${label}`}</p>
        <p className="text-blue-600">{`Projects: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
});
CustomTooltip.displayName = 'CustomTooltip';

// Custom dot component for data points - memoized to prevent re-renders
const CustomDot = React.memo((props: any) => {
  const { cx, cy, fill } = props;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={fill}
      stroke="white"
      strokeWidth={2}
      className="hover:r-4 transition-all duration-200"
    />
  );
});
CustomDot.displayName = 'CustomDot';

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
      index
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
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={strokeWidth}
            dot={<CustomDot fill={color} />}
            activeDot={{ r: 4, fill: color, stroke: 'white', strokeWidth: 2 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
Sparkline.displayName = 'Sparkline';

export default Sparkline;
