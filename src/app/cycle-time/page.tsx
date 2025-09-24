'use client';

import { useState, useEffect } from 'react';
import BoxPlotChart from '@/components/BoxPlotChart';
import ComplexityBoxPlotChart from '@/components/ComplexityBoxPlotChart';
import { useCycleTimeContext } from '@/contexts/CycleTimeContext';

interface CycleTimeCohort {
  quarter: string;
  data: number[];
  outliers: number[];
  size: number;
  stats: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
  };
}

interface CycleTimeData {
  cohorts: {
    [quarter: string]: CycleTimeCohort;
  };
}

interface ProjectDetail {
  key: string;
  summary: string;
  assignee: string;
  discoveryComplexity?: string | null;
  discoveryStart: string;
  activeDiscoveryTime: number;
  calendarDiscoveryTime: number;
  isExcluded?: boolean;
}

export default function CycleTimePage() {
  const [cycleTimeData, setCycleTimeData] = useState<CycleTimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<'days' | 'weeks'>('days');
  const [timeType, setTimeType] = useState<'calendar' | 'active'>('calendar');
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [projectDetails, setProjectDetails] = useState<ProjectDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [excludedIssues, setExcludedIssues] = useState<Set<string>>(new Set());
  const [togglingExclusion, setTogglingExclusion] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [complexityData, setComplexityData] = useState<any>(null);
  const [complexityLoading, setComplexityLoading] = useState(false);
  const [selectedComplexity, setSelectedComplexity] = useState<string | null>(null);
  const [complexityProjectDetails, setComplexityProjectDetails] = useState<ProjectDetail[]>([]);
  const [complexityDetailsLoading, setComplexityDetailsLoading] = useState(false);
  const [complexityChartData, setComplexityChartData] = useState<any>(null);
  const [complexityChartLoading, setComplexityChartLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const { activeTab, setActiveTab } = useCycleTimeContext();

  const fetchCycleTimeData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cycle-time-analysis?timeType=${timeType}`);
      const result = await response.json();
      
      if (result.success) {
        setCycleTimeData(result.data);
      } else {
        setError(result.error || 'Failed to fetch cycle time data');
      }
    } catch (err) {
      setError('Failed to fetch cycle time data');
      console.error('Error fetching cycle time data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComplexityData = async () => {
    try {
      setComplexityLoading(true);
      const response = await fetch(`/api/cycle-time-by-complexity?timeType=${timeType}`);
      const result = await response.json();
      
      if (result.success) {
        setComplexityData(result.data);
      } else {
        console.error('Error fetching complexity data:', result.error);
      }
    } catch (err) {
      console.error('Error fetching complexity data:', err);
    } finally {
      setComplexityLoading(false);
    }
  };

  const fetchComplexityChartData = async () => {
    try {
      setComplexityChartLoading(true);
      const response = await fetch(`/api/cycle-time-by-complexity-chart?timeType=${timeType}`);
      const result = await response.json();
      
      if (result.success) {
        setComplexityChartData(result.data);
      } else {
        console.error('Failed to fetch complexity chart data:', result.error);
      }
    } catch (err) {
      console.error('Error fetching complexity chart data:', err);
    } finally {
      setComplexityChartLoading(false);
    }
  };

  useEffect(() => {
    fetchCycleTimeData();
    fetchComplexityData();
    fetchComplexityChartData();
    fetchExcludedIssues();
  }, [timeType]);

  const fetchProjectDetails = async (quarter: string) => {
    try {
      setDetailsLoading(true);
      setSelectedQuarter(quarter);
      
      const response = await fetch(`/api/cycle-time-details?quarter=${quarter}`);
      const result = await response.json();
      
      if (result.success) {
        // Add exclusion state to project details
        const projectsWithExclusion = result.data.map((project: ProjectDetail) => ({
          ...project,
          isExcluded: excludedIssues.has(project.key)
        }));
        setProjectDetails(projectsWithExclusion);
      } else {
        console.error('Error fetching project details:', result.error);
        setProjectDetails([]);
      }
    } catch (err) {
      console.error('Error fetching project details:', err);
      setProjectDetails([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchComplexityProjectDetails = async (complexity: string) => {
    try {
      setComplexityDetailsLoading(true);
      setSelectedComplexity(complexity);
      
      const response = await fetch(`/api/cycle-time-details-by-complexity?complexity=${complexity}&timeType=${timeType}`);
      const result = await response.json();
      
      if (result.success) {
        // Add exclusion state to project details
        const projectsWithExclusion = result.data.map((project: ProjectDetail) => ({
          ...project,
          isExcluded: excludedIssues.has(project.key)
        }));
        setComplexityProjectDetails(projectsWithExclusion);
      } else {
        console.error('Error fetching complexity project details:', result.error);
        setComplexityProjectDetails([]);
      }
    } catch (err) {
      console.error('Error fetching complexity project details:', err);
      setComplexityProjectDetails([]);
    } finally {
      setComplexityDetailsLoading(false);
    }
  };

  const refreshFromJira = async () => {
    if (!selectedQuarter) return;
    
    try {
      setDetailsLoading(true);
      
      // Get all issue keys from current data
      const issueKeys = projectDetails.map(project => project.key);
      
      if (issueKeys.length === 0) {
        console.log('No issues to refresh');
        return;
      }

      // Refresh specific issues from Jira
      const refreshResponse = await fetch('/api/refresh-specific-issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ issueKeys }),
      });

      const refreshResult = await refreshResponse.json();
      
      if (refreshResult.success) {
        console.log(`Refreshed ${refreshResult.data.refreshedIssues.length} issues from Jira`);
        
        // Clear the project details cache for this quarter to force rebuild
        await fetch(`/api/clear-project-details-cache?quarter=${selectedQuarter}`, {
          method: 'POST'
        });
        
        // Now fetch the updated data from database (this will rebuild the cache)
        await fetchProjectDetails(selectedQuarter);
      } else {
        console.error('Failed to refresh from Jira:', refreshResult.error);
      }
    } catch (err) {
      console.error('Error refreshing from Jira:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshComplexityFromJira = async () => {
    try {
      setComplexityDetailsLoading(true);
      setComplexityLoading(true);
      
      // Get all active issues from the database to refresh
      const allIssuesResponse = await fetch('/api/get-all-issue-keys');
      const allIssuesResult = await allIssuesResponse.json();
      
      if (!allIssuesResult.success) {
        console.error('Failed to get issue keys:', allIssuesResult.error);
        return;
      }
      
      const issueObjects = allIssuesResult.data.issueKeys;
      const issueKeys = issueObjects.map((issue: any) => issue.key);
      console.log(`Refreshing ${issueKeys.length} issues from Jira...`);

      // Refresh all issues from Jira
      const refreshResponse = await fetch('/api/refresh-specific-issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ issueKeys }),
      });

      const refreshResult = await refreshResponse.json();
      
      if (refreshResult.success) {
        console.log(`Refreshed ${refreshResult.data.refreshedIssues.length} issues from Jira`);
        
        // Recalculate cycle time cache for the refreshed issues
        const recalcResponse = await fetch('/api/recalculate-cycle-cache', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ issueKeys }),
        });
        
        if (recalcResponse.ok) {
          console.log('Recalculated cycle time cache for refreshed issues');
        }
        
        // Refresh the main complexity data to get updated counts
        await fetchComplexityData();
        await fetchComplexityChartData();
        
        // Now fetch the updated project details
        if (selectedComplexity) {
          await fetchComplexityProjectDetails(selectedComplexity);
        }
      } else {
        console.error('Failed to refresh from Jira:', refreshResult.error);
      }
    } catch (err) {
      console.error('Error refreshing from Jira:', err);
    } finally {
      setComplexityDetailsLoading(false);
      setComplexityLoading(false);
    }
  };

  const convertToWeeks = (data: CycleTimeData): CycleTimeData => {
    const convertedCohorts: { [quarter: string]: CycleTimeCohort } = {};
    
    Object.entries(data.cohorts).forEach(([quarter, cohort]) => {
      convertedCohorts[quarter] = {
        ...cohort,
        data: cohort.data.map(days => Math.round(days / 7 * 10) / 10),
        outliers: cohort.outliers.map(days => Math.round(days / 7 * 10) / 10),
        stats: {
          min: Math.round(cohort.stats.min / 7 * 10) / 10,
          q1: Math.round(cohort.stats.q1 / 7 * 10) / 10,
          median: Math.round(cohort.stats.median / 7 * 10) / 10,
          q3: Math.round(cohort.stats.q3 / 7 * 10) / 10,
          max: Math.round(cohort.stats.max / 7 * 10) / 10,
        }
      };
    });

    return { cohorts: convertedCohorts };
  };

  const fetchExcludedIssues = async () => {
    try {
      const response = await fetch(`/api/project-exclusions`);
      const result = await response.json();
      
      if (result.success) {
        setExcludedIssues(new Set(result.data.excludedIssues));
      }
    } catch (err) {
      console.error('Error fetching excluded issues:', err);
    }
  };

  const toggleExclusion = async (issueKey: string) => {
    try {
      setTogglingExclusion(issueKey);
      
      const response = await fetch(`/api/project-exclusions/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issueKey,
          excludedBy: 'user', // You could make this dynamic
          reason: 'Manual exclusion from cycle time analysis'
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        const newExcludedIssues = new Set(excludedIssues);
        if (result.data.isExcluded) {
          newExcludedIssues.add(issueKey);
        } else {
          newExcludedIssues.delete(issueKey);
        }
        setExcludedIssues(newExcludedIssues);
        
        // Update project details to reflect exclusion state
        setProjectDetails(prev => 
          prev.map(project => 
            project.key === issueKey 
              ? { ...project, isExcluded: result.data.isExcluded }
              : project
          )
        );
        
        // Refresh cycle time data to reflect exclusions
        await fetchCycleTimeData();
      }
    } catch (err) {
      console.error('Error toggling exclusion:', err);
    } finally {
      setTogglingExclusion(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading cycle time analysis...</div>
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
              onClick={fetchCycleTimeData}
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!cycleTimeData) {
    return (
      <div className="text-center py-8 text-gray-500">
        No cycle time data available
      </div>
    );
  }

  const exportToCSV = async () => {
    try {
      setExportLoading(true);
      
      let exportUrl = '/api/export-cycle-time-details?';
      const params = new URLSearchParams();
      
      if (activeTab === 'quarter' && selectedQuarter) {
        // For quarter tab, export only the selected quarter
        params.append('quarter', selectedQuarter);
      }
      // For complexity tab, don't add complexity filter - export all projects
      
      params.append('timeType', timeType);
      exportUrl += params.toString();
      
      const response = await fetch(exportUrl);
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      
      // Get the CSV content
      const csvContent = await response.text();
      
      // Create a blob and download it
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `discovery-cycle-times-${activeTab === 'quarter' ? `quarter-${selectedQuarter}` : 'all-complexities'}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const displayData = unit === 'weeks' ? convertToWeeks(cycleTimeData) : cycleTimeData;
  const totalProjects = Object.values(cycleTimeData.cohorts).reduce((sum, cohort) => sum + cohort.size, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium text-gray-900">
                  Discovery Cycle Time Analysis
                </h2>
                <button
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="How cycle times are calculated"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Analysis of completed discovery cycles
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Total projects: {totalProjects}
              </div>
              <button
                onClick={exportToCSV}
                disabled={exportLoading || (activeTab === 'quarter' && !selectedQuarter)}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {exportLoading ? 'Exporting...' : activeTab === 'quarter' ? 'Export Quarter to CSV' : 'Export All to CSV'}
              </button>
              <button
                onClick={async () => {
                  await fetchCycleTimeData();
                  await fetchComplexityData();
                  await fetchComplexityChartData();
                }}
                disabled={loading || complexityLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {(loading || complexityLoading) ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          </div>

          {/* Help Section */}
          {showHelp && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-3">How Cycle Times Are Calculated</h3>
              
              <div className="space-y-4 text-sm text-blue-800">
                <div>
                  <h4 className="font-medium mb-2">Discovery Cycle Definition</h4>
                    <p className="mb-2">
                      A discovery cycle starts when a project transitions to any discovery status (02 Generative Discovery, 04 Problem Discovery, or 05 Solution Discovery) for the first time and ends when it transitions to a build or resolved status (06 Build, 07 Beta, 08 Live, or 09 Live, Won&apos;t Do).
                    </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Calendar vs Active Time</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-blue-900 mb-1">Calendar Time</h5>
                      <p className="mb-2">Total elapsed time from discovery start to discovery end, including all days (weekends, holidays, etc.).</p>
                      <div className="bg-white p-3 rounded border text-xs">
                        <strong>Example:</strong> Project starts discovery on Monday, ends on Friday of the following week = 12 calendar days
                      </div>
                    </div>
                    <div>
                      <h5 className="font-medium text-blue-900 mb-1">Active Time</h5>
                      <p className="mb-2">Time excluding periods when the project was on hold (Health = On Hold) or inactive (03 Committed or back to 01 Inbox).</p>
                      <div className="bg-white p-3 rounded border text-xs">
                        <strong>Example:</strong> Same project but excluding 2 days on hold = 10 active days
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Box Plot Statistics</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Min/Max:</strong> Shortest and longest cycle times in the quarter</li>
                    <li><strong>Q1 (25th percentile):</strong> 25% of projects completed faster than this</li>
                    <li><strong>Median (50th percentile):</strong> Half of projects completed faster than this</li>
                    <li><strong>Q3 (75th percentile):</strong> 75% of projects completed faster than this</li>
                    <li><strong>Outliers:</strong> Projects with unusually long cycle times (beyond 1.5 × IQR from Q3)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Data Quality Notes</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Only completed discovery cycles are included in the analysis</li>
                    <li>Projects can be excluded from analysis if they represent special cases</li>
                    <li>Cycle times are calculated based on Jira status transitions</li>
                    <li>Data is cached for performance and refreshed periodically</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="mb-6">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Time type:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setTimeType('calendar')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      timeType === 'calendar'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Calendar
                  </button>
                  <button
                    onClick={() => setTimeType('active')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      timeType === 'active'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Active
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Display units:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setUnit('days')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      unit === 'days'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Days
                  </button>
                  <button
                    onClick={() => setUnit('weeks')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      unit === 'weeks'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Weeks
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'quarter' && (
            <>
              {/* Chart */}
              <div className="mb-6">
                <BoxPlotChart data={displayData} unit={unit} />
              </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(cycleTimeData.cohorts)
              .sort(([a], [b]) => {
                // Sort quarters chronologically (Q3_2024, Q4_2024, Q1_2025, Q2_2025, Q3_2025, etc.)
                const [qA, yearA] = a.split('_');
                const [qB, yearB] = b.split('_');
                
                // Compare years first
                if (yearA !== yearB) {
                  return parseInt(yearA) - parseInt(yearB);
                }
                
                // If same year, compare quarters
                const quarterOrder = { 'Q1': 1, 'Q2': 2, 'Q3': 3, 'Q4': 4 };
                return quarterOrder[qA as keyof typeof quarterOrder] - quarterOrder[qB as keyof typeof quarterOrder];
              })
              .map(([quarter, cohort]) => (
              <div 
                key={quarter} 
                className={`bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors ${
                  selectedQuarter === quarter ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => fetchProjectDetails(quarter)}
              >
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  {quarter.replace('_2025', ' 2025')} (n={cohort.size})
                </h3>
                {cohort.size > 0 ? (
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Range: {unit === 'weeks' ? Math.round(cohort.stats.min / 7 * 10) / 10 : cohort.stats.min} to {unit === 'weeks' ? Math.round(cohort.stats.max / 7 * 10) / 10 : cohort.stats.max} {unit}</div>
                    <div>Median: {unit === 'weeks' ? Math.round(cohort.stats.median / 7 * 10) / 10 : cohort.stats.median} {unit}</div>
                    {cohort.outliers.length > 0 && (
                      <div className="text-red-600">Outliers: {cohort.outliers.length}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No completed projects</div>
                )}
              </div>
            ))}
          </div>

          {/* Project Details Table */}
          {selectedQuarter && (
            <div className="mt-6 bg-white border border-gray-200 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    Projects in {selectedQuarter.replace('_2025', ' 2025')}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={refreshFromJira}
                      disabled={detailsLoading}
                      className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {detailsLoading ? 'Refreshing...' : 'Refresh from Jira'}
                    </button>
                    <button
                      onClick={() => setSelectedQuarter(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
              
              {detailsLoading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading project details...
                </div>
              ) : projectDetails.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No projects found for this quarter
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project Key
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Summary
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assignee
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Discovery Complexity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Discovery Start
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Active Discovery Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Calendar Discovery Time
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Exclude
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {projectDetails.map((project, index) => (
                        <tr key={project.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <a 
                              href={`https://hometap.atlassian.net/browse/${project.key}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {project.key}
                            </a>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {project.summary}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {project.assignee}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              project.discoveryComplexity === 'Simple' 
                                ? 'bg-green-100 text-green-800' 
                                : project.discoveryComplexity === 'Standard'
                                ? 'bg-blue-100 text-blue-800'
                                : project.discoveryComplexity === 'Complex'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {project.discoveryComplexity || 'Not Set'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {project.discoveryStart}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {unit === 'weeks' ? Math.round(project.activeDiscoveryTime / 7 * 10) / 10 : project.activeDiscoveryTime} {unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {unit === 'weeks' ? Math.round(project.calendarDiscoveryTime / 7 * 10) / 10 : project.calendarDiscoveryTime} {unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => toggleExclusion(project.key)}
                              disabled={togglingExclusion === project.key}
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                                excludedIssues.has(project.key)
                                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                              } ${togglingExclusion === project.key ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {togglingExclusion === project.key ? (
                                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                              ) : excludedIssues.has(project.key) ? (
                                'Excluded'
                              ) : (
                                'Include'
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
            </>
          )}

          {activeTab === 'complexity' && (
            <div className="mt-6">
              {/* Cycle Time by Complexity */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Cycle Time by Complexity
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Analysis across all quarters - {timeType === 'calendar' ? 'Calendar' : 'Active'} days
              </p>
            </div>
            
            {complexityLoading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                Loading complexity analysis...
              </div>
            ) : complexityData ? (
              <div className="p-6">
                {/* Boxplot Chart */}
                {complexityChartLoading ? (
                  <div className="mb-6 p-8 text-center text-gray-500">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                    Loading complexity chart...
                  </div>
                ) : complexityChartData ? (
                  <div className="mb-6">
                    <ComplexityBoxPlotChart data={complexityChartData} unit={unit} />
                  </div>
                ) : null}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(complexityData.complexityGroups).map(([complexity, group]: [string, any]) => (
                    <div 
                      key={complexity} 
                      className={`bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors ${
                        selectedComplexity === complexity ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => fetchComplexityProjectDetails(complexity)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-900 capitalize">
                          {complexity}
                        </h4>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          complexity === 'Simple' 
                            ? 'bg-green-100 text-green-800' 
                            : complexity === 'Standard'
                            ? 'bg-blue-100 text-blue-800'
                            : complexity === 'Complex'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {group.size} projects
                        </span>
                      </div>
                      
                      {group.size > 0 ? (
                        <div className="space-y-2">
                          <div className="text-2xl font-bold text-gray-900">
                            {unit === 'weeks' 
                              ? Math.round(group.stats.mean / 7 * 10) / 10 
                              : group.stats.mean
                            } {unit}
                          </div>
                          <div className="text-sm text-gray-600">
                            Average cycle time
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="text-gray-500">Median</div>
                              <div className="font-medium">
                                {unit === 'weeks' 
                                  ? Math.round(group.stats.median / 7 * 10) / 10 
                                  : group.stats.median
                                } {unit}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500">Range</div>
                              <div className="font-medium">
                                {unit === 'weeks' 
                                  ? `${Math.round(group.stats.min / 7 * 10) / 10}-${Math.round(group.stats.max / 7 * 10) / 10}`
                                  : `${group.stats.min}-${group.stats.max}`
                                } {unit}
                              </div>
                            </div>
                          </div>
                          
                          {group.size < 5 && (
                            <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                              ⚠️ Small sample size ({group.size} projects)
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          No completed projects
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 text-xs text-gray-500">
                  <p>
                    <strong>Forecasting Guidelines:</strong> Use these averages as starting points for project planning. 
                    Consider the range and sample size when setting expectations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No complexity data available
              </div>
            )}

            {/* Complexity Project Details Table */}
            {selectedComplexity && (
              <div className="mt-6 bg-white border border-gray-200 rounded-lg">
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedComplexity} Projects
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={refreshComplexityFromJira}
                        disabled={complexityDetailsLoading || complexityLoading}
                        className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2"
                      >
                        {(complexityDetailsLoading || complexityLoading) ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Syncing from Jira...
                          </>
                        ) : (
                          'Refresh from Jira'
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedComplexity(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
                
                {complexityDetailsLoading ? (
                  <div className="p-4 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Syncing from Jira and updating data...
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      This may take up to a minute for large datasets
                    </p>
                  </div>
                ) : complexityProjectDetails.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No projects found for this complexity level
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Project Key
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Summary
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Assignee
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Discovery Complexity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Discovery Start
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Active Discovery Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Calendar Discovery Time
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Exclude
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {complexityProjectDetails.map((project, index) => (
                          <tr key={project.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <a 
                                href={`https://hometap.atlassian.net/browse/${project.key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {project.key}
                              </a>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                              {project.summary}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {project.assignee}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                project.discoveryComplexity === 'Simple' 
                                  ? 'bg-green-100 text-green-800' 
                                  : project.discoveryComplexity === 'Standard'
                                  ? 'bg-blue-100 text-blue-800'
                                  : project.discoveryComplexity === 'Complex'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}>
                                {project.discoveryComplexity || 'Not Set'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {project.discoveryStart}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {unit === 'weeks' ? Math.round(project.activeDiscoveryTime / 7 * 10) / 10 : project.activeDiscoveryTime} {unit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {unit === 'weeks' ? Math.round(project.calendarDiscoveryTime / 7 * 10) / 10 : project.calendarDiscoveryTime} {unit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => toggleExclusion(project.key)}
                                disabled={togglingExclusion === project.key}
                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                                  excludedIssues.has(project.key)
                                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                } ${togglingExclusion === project.key ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                {togglingExclusion === project.key ? (
                                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                ) : excludedIssues.has(project.key) ? (
                                  'Excluded'
                                ) : (
                                  'Include'
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
