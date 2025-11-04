'use client';

import React from 'react';
import { useWorkloadData } from '@/hooks/useWorkloadData';
import { useSharedSparklineData } from '@/hooks/useSharedSparklineData';
import WorkloadCard from '@/components/WorkloadCard';

export default function Home() {
  const { workloadData, loading: workloadLoading, error: workloadError, refetch: refetchWorkload } = useWorkloadData();
  const [snapshotLoading, setSnapshotLoading] = React.useState(false);
  const [snapshotError, setSnapshotError] = React.useState<string | null>(null);
  const [snapshotMessage, setSnapshotMessage] = React.useState<string | null>(null);
  
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
  
  // Initialize sparkline hooks for each team member (now using shared fetch)
  const adamSparkline = useSharedSparklineData('Adam Sigel');
  const jennieSparkline = useSharedSparklineData('Jennie Goldenberg');
  const jacquelineSparkline = useSharedSparklineData('Jacqueline Gallagher');
  const robertSparkline = useSharedSparklineData('Robert J. Johnson');
  const garimaSparkline = useSharedSparklineData('Garima Giri');
  const lizzySparkline = useSharedSparklineData('Lizzy Magill');
  const sanelaSparkline = useSharedSparklineData('Sanela Smaka');
  
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

  const handleCreateSnapshot = async () => {
    try {
      setSnapshotLoading(true);
      setSnapshotError(null);
      setSnapshotMessage(null);
      
      const response = await fetch('/api/create-weekly-snapshot', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSnapshotMessage(`Snapshot created successfully for ${result.data.snapshotDate}`);
        // Refresh workload data to show the new snapshot
        await refetchWorkload();
      } else {
        setSnapshotError(result.error || 'Failed to create snapshot');
      }
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleCreateHistoricalSnapshots = async () => {
    try {
      setSnapshotLoading(true);
      setSnapshotError(null);
      setSnapshotMessage(null);
      
      setSnapshotMessage('Creating historical snapshots... This may take several minutes. Please wait.');
      
      const response = await fetch('/api/create-historical-snapshots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Empty body = find and create all missing weeks since Sept 15
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        const successCount = result.summary?.successful || 0;
        const errorCount = result.summary?.errors || 0;
        const total = result.summary?.total || 0;
        
        if (successCount > 0) {
          setSnapshotMessage(
            `✓ Created ${successCount} historical snapshot${successCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} error${errorCount !== 1 ? 's' : ''})` : ''}. ` +
            `This will improve performance and sparkline accuracy.`
          );
          // Refresh workload data and sparklines
          await refetchWorkload();
          await Promise.all(sparklineHooks.map(hook => hook.refresh()));
        } else {
          setSnapshotMessage(`No snapshots were created. ${errorCount > 0 ? `${errorCount} error${errorCount !== 1 ? 's' : ''} occurred.` : 'All weeks may already have snapshots.'}`);
        }
      } else {
        setSnapshotError(result.error || 'Failed to create historical snapshots');
      }
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSnapshotLoading(false);
    }
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
              Team Workload - Weekly Snapshot Data
            </h3>
            <p className="text-sm text-blue-600 mt-1">
              Project counts are from weekly snapshots (start of week) stored in capacity_data table
            </p>
            <p className="text-xs text-blue-500 mt-1">
              Active projects: status in (Generative Discovery, Problem Discovery, Solution Discovery, Build, Beta), excluding archived. All health values included.
            </p>
            {workloadData.length > 0 && (workloadData[0] as any).snapshotDate && (
              <p className="text-xs text-blue-400 mt-1">
                Current snapshot date: {(workloadData[0] as any).snapshotDate}
              </p>
            )}
            {snapshotMessage && (
              <p className="text-xs text-green-600 mt-1 font-medium">
                {snapshotMessage}
              </p>
            )}
            {snapshotError && (
              <p className="text-xs text-red-600 mt-1 font-medium">
                {snapshotError}
              </p>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleCreateSnapshot}
              disabled={snapshotLoading || loading}
              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {snapshotLoading ? 'Creating...' : 'Create Current Week Snapshot'}
            </button>
            <button
              onClick={handleCreateHistoricalSnapshots}
              disabled={snapshotLoading || loading}
              className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {snapshotLoading ? 'Processing...' : 'Create Historical Snapshots'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh Display'}
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