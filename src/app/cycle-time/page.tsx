'use client';

import { useState, useEffect } from 'react';
import BoxPlotChart from '@/components/BoxPlotChart';

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

  useEffect(() => {
    fetchCycleTimeData();
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
                Box-and-whisker analysis of {timeType} discovery cycle times by completion quarter
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Total projects: {totalProjects}
              </div>
              <button
                onClick={fetchCycleTimeData}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
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
                  <button
                    onClick={() => setSelectedQuarter(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
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
    </div>
  );
}
