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

  const fetchCycleTimeData = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://jira-dashboard-5kcaaaix5-adam-sigels-projects-2bc3f53e.vercel.app'
        : '';
      const response = await fetch(`${baseUrl}/api/cycle-time-analysis?timeType=${timeType}`);
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
  }, [timeType]);

  const fetchProjectDetails = async (quarter: string) => {
    try {
      setDetailsLoading(true);
      setSelectedQuarter(quarter);
      
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://jira-dashboard-5kcaaaix5-adam-sigels-projects-2bc3f53e.vercel.app'
        : '';
      const response = await fetch(`${baseUrl}/api/cycle-time-details?quarter=${quarter}`);
      const result = await response.json();
      
      if (result.success) {
        setProjectDetails(result.data);
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
              <h2 className="text-lg font-medium text-gray-900">
                Discovery Cycle Time Analysis
              </h2>
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
            {Object.entries(cycleTimeData.cohorts).map(([quarter, cohort]) => (
              <div 
                key={quarter} 
                className={`bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors ${
                  selectedQuarter === quarter ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => fetchProjectDetails(quarter)}
              >
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  {quarter.replace('_2025', ' 2025')} (n = {cohort.size})
                </h3>
                {cohort.size > 0 ? (
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Median: {unit === 'weeks' ? Math.round(cohort.stats.median / 7 * 10) / 10 : cohort.stats.median} {unit}</div>
                    <div>1st Quartile: {unit === 'weeks' ? Math.round(cohort.stats.q1 / 7 * 10) / 10 : cohort.stats.q1} {unit}</div>
                    <div>3rd Quartile: {unit === 'weeks' ? Math.round(cohort.stats.q3 / 7 * 10) / 10 : cohort.stats.q3} {unit}</div>
                    <div>Min: {unit === 'weeks' ? Math.round(cohort.stats.min / 7 * 10) / 10 : cohort.stats.min} {unit}</div>
                    <div>Max: {unit === 'weeks' ? Math.round(cohort.stats.max / 7 * 10) / 10 : cohort.stats.max} {unit}</div>
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
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {projectDetails.map((project, index) => (
                        <tr key={project.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            {project.key}
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
