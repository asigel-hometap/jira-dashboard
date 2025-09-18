'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface DateRangeFilterProps {
  onDateRangeChange: (startDate: string, endDate: string) => void;
  availableDates: string[];
  className?: string;
}

function DateRangeFilter({ 
  onDateRangeChange, 
  availableDates, 
  className = '' 
}: DateRangeFilterProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  // Memoize sorted dates to prevent unnecessary recalculations
  const sortedDates = useMemo(() => {
    return [...availableDates].sort();
  }, [availableDates]);

  // Set default date range when available dates change
  useEffect(() => {
    if (availableDates.length > 0) {
      setStartDate(sortedDates[0]);
      setEndDate(sortedDates[sortedDates.length - 1]);
    }
  }, [availableDates, sortedDates]);

  // Validate and apply date range
  useEffect(() => {
    if (startDate && endDate && sortedDates.length > 0) {
      const earliestDate = sortedDates[0];
      const latestDate = sortedDates[sortedDates.length - 1];

      // Clear previous error
      setError('');

      // Validate start date is not before earliest available data
      if (startDate < earliestDate) {
        setError(`Start date cannot be before ${earliestDate} (earliest available data)`);
        return;
      }

      // Validate end date is not after latest available data
      if (endDate > latestDate) {
        setError(`End date cannot be after ${latestDate} (latest available data)`);
        return;
      }

      // Validate start date is not after end date
      if (startDate > endDate) {
        setError('Start date cannot be after end date');
        return;
      }

      // Apply the filter
      onDateRangeChange(startDate, endDate);
    }
  }, [startDate, endDate, sortedDates]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };

  const resetToFullRange = () => {
    if (availableDates.length > 0) {
      setStartDate(sortedDates[0]);
      setEndDate(sortedDates[sortedDates.length - 1]);
    }
  };

  return (
    <div className={`bg-white p-4 rounded-lg border border-gray-200 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Date Range Filter</h3>
        <button
          onClick={resetToFullRange}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Reset to Full Range
        </button>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <label htmlFor="start-date" className="block text-xs font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            min={availableDates.length > 0 ? sortedDates[0] : undefined}
            max={availableDates.length > 0 ? sortedDates[sortedDates.length - 1] : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex-1">
          <label htmlFor="end-date" className="block text-xs font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            min={availableDates.length > 0 ? sortedDates[0] : undefined}
            max={availableDates.length > 0 ? sortedDates[sortedDates.length - 1] : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      
      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      
      {availableDates.length > 0 && (
        <div className="mt-2 text-xs text-gray-700">
          Available data: {sortedDates[0]} to {sortedDates[sortedDates.length - 1]}
        </div>
      )}
    </div>
  );
}

export default React.memo(DateRangeFilter);
