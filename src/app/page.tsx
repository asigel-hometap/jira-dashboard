'use client';

import { useState, useEffect } from 'react';
import { WorkloadData } from '@/types/jira';
import Sparkline from '@/components/Sparkline';
import HealthBadges from '@/components/HealthBadges';

interface DataContext {
  lastUpdated: Date;
  dataSource: string;
}



export default function Home() {
  const [workloadData, setWorkloadData] = useState<WorkloadData[]>([]);
  const [trendsData, setTrendsData] = useState<Record<string, number[]> | null>(null);
  const [dataContext, setDataContext] = useState<DataContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkloadData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workload');
      const result = await response.json();
      
      if (result.success) {
        setWorkloadData(result.data);
      } else {
        setError(result.error || 'Failed to fetch workload data');
      }
    } catch (err) {
      setError('Network error fetching data');
    } finally {
      setLoading(false);
    }
  };


  const fetchDataContext = async () => {
    try {
      const response = await fetch('/api/data-context');
      const result = await response.json();
      
      if (result.success) {
        setDataContext(result.data);
      }
    } catch (err) {
      console.error('Error fetching data context:', err);
    }
  };


  const fetchTrendsData = async () => {
    try {
      const response = await fetch('/api/workload-trends');
      const result = await response.json();
      
      if (result.success) {
        setTrendsData(result.data);
      }
    } catch (err) {
      console.error('Error fetching trends data:', err);
    }
  };

  useEffect(() => {
    fetchWorkloadData();
    fetchTrendsData();
    fetchDataContext();
  }, []);

  // Helper function to get trend data for a team member
  const getTrendData = (teamMember: string): number[] => {
    if (!trendsData) return [];
    
    const nameMap: { [key: string]: string } = {
      'Adam Sigel': 'adam',
      'Jennie Goldenberg': 'jennie',
      'Jacqueline Gallagher': 'jacqueline',
      'Robert J. Johnson': 'robert',
      'Garima Giri': 'garima',
      'Lizzy Magill': 'lizzy',
      'Sanela Smaka': 'sanela'
    };
    
    const key = nameMap[teamMember];
    if (!key) return [];
    
    const data = trendsData[key as keyof typeof trendsData];
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'number') {
      return data as number[];
    }
    return [];
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
            </div>
            <button
              onClick={fetchWorkloadData}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
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
              <div
                key={member.teamMember}
                className={`relative bg-white p-6 rounded-lg border-2 ${
                  member.isOverloaded 
                    ? 'border-red-200 bg-red-50' 
                    : 'border-gray-200'
                }`}
              >
                {member.isOverloaded && (
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Overloaded
                    </span>
                  </div>
                )}
                
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">
                        {member.teamMember.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-900">
                      {member.teamMember}
                    </h3>
                    <p className="text-2xl font-semibold text-gray-900">
                      {member.activeProjectCount}
                    </p>
                    <p className="text-sm text-gray-500">active projects</p>
                  </div>
                </div>

                <div className="mt-4">
                  {/* Workload Trend Sparkline */}
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Workload Trend</div>
                    <Sparkline 
                      data={getTrendData(member.teamMember)}
                      width={400}
                      height={40}
                      color={member.isOverloaded ? '#EF4444' : '#3B82F6'}
                      strokeWidth={2}
                      showTooltip={true}
                    />
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-2">Project Health</div>
                    <HealthBadges healthBreakdown={member.healthBreakdown} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


    </div>
  );
}