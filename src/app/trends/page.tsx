'use client';

import React, { useState } from 'react';
import { useTrendsPageData } from '@/hooks/useTrendsPageData';
import TrendsChart from '@/components/TrendsChart';

export default function TrendsPage() {
  const [seriesType, setSeriesType] = useState<'health' | 'status'>('health');
  
  const {
    trendData,
    loading,
    error,
    filters,
    tempFilters,
    availableFilters,
    loadingStep,
    loadingText,
    chartData,
    handleApplyFilters,
    handleClearFilters,
    handleFilterChange
  } = useTrendsPageData();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {loadingText}
                </h3>
                <div className="w-64 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(loadingStep / 2) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <div className="text-red-600 text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Trends Over Time</h1>
          <p className="mt-2 text-gray-600">
            Track project health and status trends across the team
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Filters</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assignee Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Members
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                  {availableFilters.assignees.map((assignee) => (
                    <label key={assignee} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={tempFilters.assignees.includes(assignee)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleFilterChange('assignees', [...tempFilters.assignees, assignee]);
                          } else {
                            handleFilterChange('assignees', tempFilters.assignees.filter(a => a !== assignee));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{assignee}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleApplyFilters}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Apply Filters
              </button>
              <button
                onClick={handleClearFilters}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Chart Controls */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Chart View</h2>
          </div>
          <div className="p-6">
            <div className="flex space-x-4">
              <button
                onClick={() => setSeriesType('health')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  seriesType === 'health'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Health Breakdown
              </button>
              <button
                onClick={() => setSeriesType('status')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  seriesType === 'status'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Status Breakdown
              </button>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              {seriesType === 'health' ? 'Project Health Trends' : 'Project Status Trends'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {trendData.length} weeks of data
            </p>
          </div>
          <div className="p-6">
            <TrendsChart 
              data={chartData} 
              seriesType={seriesType} 
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}