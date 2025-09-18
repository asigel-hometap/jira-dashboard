'use client';

import React from 'react';
import { useWorkloadData } from '@/hooks/useWorkloadData';
import { useTrendsData } from '@/hooks/useTrendsData';
import WorkloadCard from '@/components/WorkloadCard';

export default function Home() {
  const { workloadData, loading: workloadLoading, error: workloadError, refetch: refetchWorkload } = useWorkloadData();
  const { 
    dataContext, 
    loading: trendsLoading, 
    error: trendsError, 
    globalMaxProjects, 
    trendDataMap,
    refetch: refetchTrends
  } = useTrendsData();

  const loading = workloadLoading || trendsLoading;
  const error = workloadError || trendsError;

  const handleRefresh = async () => {
    await Promise.all([refetchWorkload(), refetchTrends()]);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error loading data
            </h3>
            <div className="mt-2 text-sm text-red-700">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
              {/* Data Context Header */}
              {dataContext && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-medium text-blue-800">
                        Data Last Updated: {new Date(dataContext.lastUpdated).toLocaleString()}
                      </h3>
                      <p className="text-sm text-blue-600 mt-1">
                        Source: {dataContext.dataSource}
                      </p>
                      {(dataContext as any).historicalDataThrough && (
                        <p className="text-xs text-blue-500 mt-1">
                          Historical data through: {new Date((dataContext as any).historicalDataThrough).toLocaleDateString()}
                          {(dataContext as any).realTimeDataAvailable && ' • Real-time data active'}
                        </p>
                      )}
                    </div>
            <div className="flex space-x-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
              <a 
                href="/cache-management" 
                className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Cache Management
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Team Workload Overview
          </h2>
          
          
          <div className="grid grid-cols-1 gap-6">
            {workloadData.map((member) => (
              <WorkloadCard
                key={member.teamMember}
                member={member}
                trendData={trendDataMap.get(member.teamMember) || { data: [], dates: [] }}
                globalMaxProjects={globalMaxProjects}
              />
            ))}
          </div>
        </div>
      </div>


    </div>
  );
}