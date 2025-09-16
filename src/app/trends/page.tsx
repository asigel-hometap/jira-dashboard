'use client';

import { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TrendData {
  week: string;
  totalProjects: number;
  healthBreakdown: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    onHold: number;
    mystery: number;
    complete: number;
    unknown: number;
  };
  statusBreakdown: {
    generativeDiscovery: number;
    problemDiscovery: number;
    solutionDiscovery: number;
    build: number;
    beta: number;
    live: number;
    wonDo: number;
    unknown: number;
  };
}

export default function TrendsPage() {
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seriesType, setSeriesType] = useState<'health' | 'status'>('health');
  const [filters, setFilters] = useState({
    assignees: [] as string[],
    bizChamp: ''
  });
  const [tempFilters, setTempFilters] = useState({
    assignees: [] as string[],
    bizChamp: ''
  });
  const [availableFilters, setAvailableFilters] = useState({
    assignees: [] as string[],
    bizChamps: [] as string[]
  });
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingText, setLoadingText] = useState('');

  const fetchTrendData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadingStep(0);
      
      // Start cycling text
      const cyclingTexts = [
        'Connecting to database...',
        'Loading project data...',
        'Analyzing historical trends...',
        'Processing health breakdowns...',
        'Calculating status distributions...',
        'Generating chart data...',
        'Almost ready...'
      ];
      
      let textIndex = 0;
      const textInterval = setInterval(() => {
        setLoadingText(cyclingTexts[textIndex]);
        textIndex = (textIndex + 1) % cyclingTexts.length;
      }, 800);
      
      // Simulate progress steps
      const stepInterval = setInterval(() => {
        setLoadingStep(prev => Math.min(prev + 1, 2));
      }, 2000);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.assignees.length > 0) {
        filters.assignees.forEach(assignee => params.append('assignee', assignee));
      }
      if (filters.bizChamp) params.append('bizChamp', filters.bizChamp);
      
      const response = await fetch(`/api/trends?${params.toString()}`);
      const result = await response.json();
      
      // Clear intervals
      clearInterval(textInterval);
      clearInterval(stepInterval);
      
      if (result.success) {
        setTrendData(result.data);
        if (result.availableFilters) {
          setAvailableFilters(result.availableFilters);
        }
      } else {
        setError(result.error || 'Failed to fetch trend data');
      }
    } catch (err) {
      setError('Failed to fetch trend data');
      console.error('Error fetching trend data:', err);
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  }, [filters]);

  useEffect(() => {
    fetchTrendData();
  }, [fetchTrendData]);

  // Initialize temp filters when available filters change
  useEffect(() => {
    if (availableFilters.assignees.length > 0) {
      // If no filters are currently applied, select all assignees by default
      if (filters.assignees.length === 0 && !filters.bizChamp) {
        setTempFilters(prev => ({
          ...prev,
          assignees: availableFilters.assignees
        }));
      } else {
        // Otherwise, filter out any assignees that are no longer available
        setTempFilters(prev => ({
          ...prev,
          assignees: prev.assignees.filter(assignee => 
            availableFilters.assignees.includes(assignee)
          )
        }));
      }
    }
  }, [availableFilters.assignees, filters.assignees.length, filters.bizChamp]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      // This will be handled by the fetchTrendData function
    };
  }, []);

  const handleApplyFilters = () => {
    setFilters(tempFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters = { assignees: availableFilters.assignees, bizChamp: '' };
    setTempFilters(clearedFilters);
    setFilters(clearedFilters);
  };

  const handleAssigneeToggle = (assignee: string) => {
    setTempFilters(prev => ({
      ...prev,
      assignees: prev.assignees.includes(assignee)
        ? prev.assignees.filter(a => a !== assignee)
        : [...prev.assignees, assignee]
    }));
  };

  const getChartData = () => {
    const labels = trendData.map(d => d.week);
    
    if (seriesType === 'health') {
      return {
        labels,
        datasets: [
          {
            label: 'On Track',
            data: trendData.map(d => d.healthBreakdown.onTrack),
            backgroundColor: '#10B981',
            borderColor: '#059669',
            borderWidth: 1,
          },
          {
            label: 'At Risk',
            data: trendData.map(d => d.healthBreakdown.atRisk),
            backgroundColor: '#F59E0B',
            borderColor: '#D97706',
            borderWidth: 1,
          },
          {
            label: 'Off Track',
            data: trendData.map(d => d.healthBreakdown.offTrack),
            backgroundColor: '#EF4444',
            borderColor: '#DC2626',
            borderWidth: 1,
          },
          {
            label: 'On Hold',
            data: trendData.map(d => d.healthBreakdown.onHold),
            backgroundColor: '#6B7280',
            borderColor: '#4B5563',
            borderWidth: 1,
          },
          {
            label: 'Mystery',
            data: trendData.map(d => d.healthBreakdown.mystery),
            backgroundColor: '#8B5CF6',
            borderColor: '#7C3AED',
            borderWidth: 1,
          },
          {
            label: 'Complete',
            data: trendData.map(d => d.healthBreakdown.complete),
            backgroundColor: '#06B6D4',
            borderColor: '#0891B2',
            borderWidth: 1,
          },
          {
            label: 'Unknown',
            data: trendData.map(d => d.healthBreakdown.unknown),
            backgroundColor: '#9CA3AF',
            borderColor: '#6B7280',
            borderWidth: 1,
          },
        ],
      };
    } else {
      return {
        labels,
        datasets: [
          {
            label: 'Generative Discovery',
            data: trendData.map(d => d.statusBreakdown.generativeDiscovery),
            backgroundColor: '#3B82F6',
            borderColor: '#2563EB',
            borderWidth: 1,
          },
          {
            label: 'Problem Discovery',
            data: trendData.map(d => d.statusBreakdown.problemDiscovery),
            backgroundColor: '#8B5CF6',
            borderColor: '#7C3AED',
            borderWidth: 1,
          },
          {
            label: 'Solution Discovery',
            data: trendData.map(d => d.statusBreakdown.solutionDiscovery),
            backgroundColor: '#EC4899',
            borderColor: '#DB2777',
            borderWidth: 1,
          },
          {
            label: 'Build',
            data: trendData.map(d => d.statusBreakdown.build),
            backgroundColor: '#F59E0B',
            borderColor: '#D97706',
            borderWidth: 1,
          },
          {
            label: 'Beta',
            data: trendData.map(d => d.statusBreakdown.beta),
            backgroundColor: '#10B981',
            borderColor: '#059669',
            borderWidth: 1,
          },
          {
            label: 'Unknown',
            data: trendData.map(d => d.statusBreakdown.unknown),
            backgroundColor: '#9CA3AF',
            borderColor: '#6B7280',
            borderWidth: 1,
          },
        ],
      };
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Project Trends Over Time - ${seriesType === 'health' ? 'Health Breakdown' : 'Status Breakdown'}`,
      },
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Week Beginning',
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Projects',
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-6">
        {/* Spinner */}
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
          </div>
        </div>
        
        {/* Loading Text */}
        <div className="text-center space-y-2">
          <div className="text-lg font-medium text-gray-900">
            {filters.assignees.length > 0 || filters.bizChamp 
              ? 'Analyzing Historical Data...' 
              : 'Preparing Trend Analysis...'
            }
          </div>
          <div className="text-sm text-gray-500 min-h-[20px]">
            {loadingText || 'Initializing...'}
          </div>
        </div>
        
        {/* Additional Info */}
        <div className="text-xs text-gray-400 text-center max-w-md">
          {filters.assignees.length > 0 || filters.bizChamp 
            ? 'This may take a moment as we analyze historical changelog data for accurate trends.'
            : 'Using simplified analysis for faster loading. Apply filters for detailed historical analysis.'
          }
        </div>
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
            <button
              onClick={fetchTrendData}
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!trendData || trendData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No trend data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                Trends Over Time
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Weekly stacked bar chart showing project distribution
                {filters.assignees.length === 0 && !filters.bizChamp && (
                  <span className="ml-2 text-blue-600 font-medium">
                    (Simplified analysis - shows project lifecycle)
                  </span>
                )}
                {(filters.assignees.length > 0 || filters.bizChamp) && (
                  <span className="ml-2 text-orange-600 font-medium">
                    (Full historical analysis - may take longer)
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {trendData.length} weeks of data
              </div>
              <button
                onClick={fetchTrendData}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-gray-700">Filters</h3>
                {(filters.assignees.length > 0 || filters.bizChamp) && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Active
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                  Show All
                </button>
                <button
                  onClick={handleApplyFilters}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Applying...' : 'Apply Filters'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assignee Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Assignees {tempFilters.assignees.length > 0 && `(${tempFilters.assignees.length} selected)`}
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
                  <div className="space-y-2">
                    {availableFilters.assignees.map(assignee => (
                      <label key={assignee} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={tempFilters.assignees.includes(assignee)}
                          onChange={() => handleAssigneeToggle(assignee)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-900">{assignee}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {tempFilters.assignees.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tempFilters.assignees.map(assignee => (
                      <span
                        key={assignee}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {assignee}
                        <button
                          onClick={() => handleAssigneeToggle(assignee)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Business Champion Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Champion
                </label>
                <select
                  value={tempFilters.bizChamp}
                  onChange={(e) => setTempFilters(prev => ({ ...prev, bizChamp: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Business Champions</option>
                  {availableFilters.bizChamps.map(bizChamp => (
                    <option key={bizChamp} value={bizChamp}>{bizChamp}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Series Toggle */}
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Series type:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSeriesType('health')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    seriesType === 'health'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Health
                </button>
                <button
                  onClick={() => setSeriesType('status')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    seriesType === 'status'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Status
                </button>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[500px]">
            <Bar data={getChartData()} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
