'use client';

import React from 'react';
import { useWorkloadData } from '@/hooks/useWorkloadData';
import { useAccurateSparklineData } from '@/hooks/useAccurateSparklineData';
import WorkloadCard from '@/components/WorkloadCard';

export default function Home() {
  const { workloadData, loading: workloadLoading, error: workloadError, refetch: refetchWorkload } = useWorkloadData();
  
  // Get sparkline data for each team member
  const teamMembers = [
    'Adam Sigel',
    'Jennie Goldenberg', 
    'Jacqueline Gallagher',
    'Robert J. Johnson',
    'Garima Giri',
    'Lizzy Magill',
    'Sanela Smaka'
  ];
  
  // Initialize sparkline hooks for each team member
  const adamSparkline = useAccurateSparklineData('Adam Sigel');
  const jennieSparkline = useAccurateSparklineData('Jennie Goldenberg');
  const jacquelineSparkline = useAccurateSparklineData('Jacqueline Gallagher');
  const robertSparkline = useAccurateSparklineData('Robert J. Johnson');
  const garimaSparkline = useAccurateSparklineData('Garima Giri');
  const lizzySparkline = useAccurateSparklineData('Lizzy Magill');
  const sanelaSparkline = useAccurateSparklineData('Sanela Smaka');
  
  const sparklineHooks = [
    adamSparkline,
    jennieSparkline,
    jacquelineSparkline,
    robertSparkline,
    garimaSparkline,
    lizzySparkline,
    sanelaSparkline
  ];
  
  const sparklineDataMap = new Map();
  teamMembers.forEach((member, index) => {
    sparklineDataMap.set(member, sparklineHooks[index]);
  });

  const loading = workloadLoading || sparklineHooks.some(hook => hook.loading);
  const error = workloadError || sparklineHooks.find(hook => hook.error)?.error;

  const handleRefresh = async () => {
    await Promise.all([
      refetchWorkload(),
      ...sparklineHooks.map(hook => hook.refresh())
    ]);
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

  // Calculate global max projects from sparkline data
  const globalMaxProjects = Math.max(
    ...sparklineHooks
      .map(hook => hook.data?.data || [])
      .flat()
      .concat([0])
  );

  return (
    <div className="space-y-6">
      {/* Data Context Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-medium text-blue-800">
              Accurate Sparkline Data
            </h3>
            <p className="text-sm text-blue-600 mt-1">
              Historical data from CSV (pre-Sept 15, 2025) + Jira trends analysis (Sept 15+)
            </p>
            <p className="text-xs text-blue-500 mt-1">
              Shows active projects: health ≠ &apos;complete&apos; AND status in (Generative Discovery, Problem Discovery, Solution Discovery, Build, Beta)
            </p>
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

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Team Workload Overview
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            {workloadData.map((member) => {
              const sparklineHook = sparklineDataMap.get(member.teamMember);
              const trendData = sparklineHook?.data ? {
                data: sparklineHook.data.data,
                dates: sparklineHook.data.dates
              } : { data: [], dates: [] };

              return (
                <WorkloadCard
                  key={member.teamMember}
                  member={member}
                  trendData={trendData}
                  globalMaxProjects={globalMaxProjects}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}