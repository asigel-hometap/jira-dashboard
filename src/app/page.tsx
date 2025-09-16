'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { WorkloadData } from '@/types/jira';
import Sparkline from '@/components/Sparkline';
import HealthBadges from '@/components/HealthBadges';
import DateRangeFilter from '@/components/DateRangeFilter';

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
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string } | null>(null);

  const fetchWorkloadData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workload`);
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
      const response = await fetch(`/api/data-context`);
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
      console.log('Fetching trends data...');
      const response = await fetch(`/api/workload-trends`);
      const result = await response.json();
      
      console.log('Trends data result:', result);
      if (result.success) {
        setTrendsData(result.data);
        console.log('Trends data set:', result.data);
      }
    } catch (err) {
      console.error('Error fetching trends data:', err);
    }
  };

  const handleDateRangeChange = useCallback((startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
  }, []);

  // Memoize dateRange to prevent infinite re-renders
  const memoizedDateRange = useMemo(() => dateRange, [dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    fetchWorkloadData();
    fetchTrendsData();
    fetchDataContext();
  }, []);

  // Create a stable list of team member names to avoid dependency on workloadData array
  const teamMemberNames = useMemo(() => {
    return workloadData.map(member => member.teamMember);
  }, [workloadData]);

  // Memoized trend data calculation to prevent infinite re-renders
  const trendDataMap = useMemo(() => {
    if (!trendsData) {
      return new Map();
    }
    
    const nameMap: { [key: string]: string } = {
      'Adam Sigel': 'adam',
      'Jennie Goldenberg': 'jennie',
      'Jacqueline Gallagher': 'jacqueline',
      'Robert J. Johnson': 'robert',
      'Garima Giri': 'garima',
      'Lizzy Magill': 'lizzy',
      'Sanela Smaka': 'sanela'
    };
    
    const map = new Map();
    
    teamMemberNames.forEach((teamMember) => {
      const key = nameMap[teamMember];
      if (!key) {
        map.set(teamMember, { data: [], dates: [] });
        return;
      }
      
      const data = trendsData[key as keyof typeof trendsData];
      const dates = trendsData.dates || [];
      
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'number') {
        let filteredData = data as number[];
        let filteredDates = dates as unknown as string[];
        
        // Apply date range filter if set
        if (memoizedDateRange) {
          const startDate = new Date(memoizedDateRange.startDate);
          const endDate = new Date(memoizedDateRange.endDate);
          
          const filteredIndices: number[] = [];
          filteredDates.forEach((date, index) => {
            const currentDate = new Date(date);
            if (currentDate >= startDate && currentDate <= endDate) {
              filteredIndices.push(index);
            }
          });
          
          filteredData = filteredIndices.map(index => filteredData[index]);
          filteredDates = filteredIndices.map(index => filteredDates[index]);
        }
        
        map.set(teamMember, { data: filteredData, dates: filteredDates });
      } else {
        map.set(teamMember, { data: [], dates: [] });
      }
    });
    
    return map;
  }, [trendsData, teamMemberNames, memoizedDateRange]);

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
            <div className="flex space-x-2">
              <button
                onClick={fetchWorkloadData}
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
          
          {/* Date Range Filter */}
          {trendsData && trendsData.dates && (
            <div className="mb-6">
              <DateRangeFilter
                onDateRangeChange={handleDateRangeChange}
                availableDates={trendsData.dates as unknown as string[]}
                className="max-w-2xl"
              />
            </div>
          )}
          
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
                
                <div className="flex gap-6">
                  {/* Left side: Team member info and project health */}
                  <div className="flex-1 space-y-4">
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

                    <div>
                      <div className="text-xs text-gray-500 mb-2">Project Health</div>
                      <HealthBadges healthBreakdown={member.healthBreakdown} />
                    </div>
                  </div>

                  {/* Right side: Workload Trend Sparkline */}
                  <div className="flex-1 max-w-2xl">
                    <div className="text-xs text-gray-500 mb-2">Workload Trend</div>
                    <div className="bg-gray-50 rounded-lg p-3">
                              <Sparkline
                                data={trendDataMap.get(member.teamMember)?.data || []}
                                dates={trendDataMap.get(member.teamMember)?.dates || []}
                                height={120}
                                color={member.isOverloaded ? '#EF4444' : '#3B82F6'}
                                strokeWidth={2}
                                showTooltip={true}
                              />
                    </div>
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