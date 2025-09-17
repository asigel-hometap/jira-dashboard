'use client';

import { useState, useEffect } from 'react';
import GanttChart from '@/components/GanttChart';

interface DiscoveryCycleDetail {
  key: string;
  name: string;
  assignee: string;
  currentStatus: string;
  discoveryStartDate: string | null;
  endDateLogic: string;
  calendarDaysInDiscovery: number | null;
  activeDaysInDiscovery: number | null;
  jiraUrl: string;
}

type SortField = 'assignee' | 'currentStatus' | 'discoveryStartDate' | 'calendarDaysInDiscovery' | 'activeDaysInDiscovery' | 'endDateLogic';
type SortDirection = 'asc' | 'desc';

export default function CycleTimeDetailsPage() {
  const [discoveryDetails, setDiscoveryDetails] = useState<DiscoveryCycleDetail[]>([]);
  const [filteredDetails, setFilteredDetails] = useState<DiscoveryCycleDetail[]>([]);
  const [ganttData, setGanttData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Filter states
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    start: string;
    end: string;
  }>({ start: '', end: '' });

  // Get unique assignees for dropdown
  const uniqueAssignees = Array.from(new Set(discoveryDetails.map(detail => detail.assignee).filter(Boolean))).sort();

  // Debug: Log ganttData changes
  useEffect(() => {
    console.log('Gantt data changed:', ganttData.length, 'projects');
    if (ganttData.length > 0) {
      console.log('First project:', ganttData[0].projectKey, ganttData[0].assignee);
    }
  }, [ganttData]);

  const fetchDiscoveryDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/discovery-cycle-details`);
      const result = await response.json();
      
      if (result.success) {
        setDiscoveryDetails(result.data);
        setFilteredDetails(result.data);
      } else {
        setError(result.error || 'Failed to fetch discovery cycle details');
      }
    } catch (err) {
      setError('Network error fetching data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGanttData = async () => {
    try {
      const params = new URLSearchParams();
      params.append('quarter', 'Q3_2025'); // Default to Q3 2025 for now
      
      if (assigneeFilter) {
        params.append('assignee', assigneeFilter);
        console.log('Fetching Gantt data with assignee filter:', assigneeFilter);
      } else {
        console.log('Fetching Gantt data without assignee filter');
      }
      
      const response = await fetch(`/api/gantt-data?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        console.log('Gantt data fetched successfully:', result.data.length, 'projects');
        setGanttData(result.data);
      } else {
        console.error('Failed to fetch Gantt data:', result.error);
      }
    } catch (err) {
      console.error('Error fetching Gantt data:', err);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedDetails = () => {
    if (!sortField) return filteredDetails;

    return [...filteredDetails].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'assignee':
          aValue = a.assignee;
          bValue = b.assignee;
          break;
        case 'currentStatus':
          aValue = a.currentStatus;
          bValue = b.currentStatus;
          break;
        case 'discoveryStartDate':
          aValue = a.discoveryStartDate || '';
          bValue = b.discoveryStartDate || '';
          break;
        case 'activeDaysInDiscovery':
          aValue = a.activeDaysInDiscovery || 0;
          bValue = b.activeDaysInDiscovery || 0;
          break;
        case 'calendarDaysInDiscovery':
          aValue = a.calendarDaysInDiscovery || 0;
          bValue = b.calendarDaysInDiscovery || 0;
          break;
        case 'endDateLogic':
          aValue = a.endDateLogic;
          bValue = b.endDateLogic;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Filtering logic
  const applyFilters = () => {
    let filtered = [...discoveryDetails];

    // Filter by assignee
    if (assigneeFilter) {
      filtered = filtered.filter(project => 
        project.assignee === assigneeFilter
      );
    }

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter(project => 
        project.currentStatus.toLowerCase().includes(statusFilter.toLowerCase())
      );
    }

    // Filter by date range
    if (dateRangeFilter.start || dateRangeFilter.end) {
      filtered = filtered.filter(project => {
        if (!project.discoveryStartDate) return false;
        
        const projectDate = new Date(project.discoveryStartDate);
        const startDate = dateRangeFilter.start ? new Date(dateRangeFilter.start) : null;
        const endDate = dateRangeFilter.end ? new Date(dateRangeFilter.end) : null;
        
        if (startDate && projectDate < startDate) return false;
        if (endDate && projectDate > endDate) return false;
        
        return true;
      });
    }

    setFilteredDetails(filtered);
  };

  // Apply filters when filter values change
  useEffect(() => {
    applyFilters();
  }, [assigneeFilter, statusFilter, dateRangeFilter, discoveryDetails]);

  useEffect(() => {
    fetchDiscoveryDetails();
    fetchGanttData();
  }, []);

  useEffect(() => {
    fetchGanttData();
  }, [assigneeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading discovery cycle details...</div>
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
              onClick={fetchDiscoveryDetails}
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Discovery Cycle Details
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Showing {filteredDetails.length} of {discoveryDetails.length} projects
              </div>
              <button
                onClick={fetchDiscoveryDetails}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          </div>
          
          {/* Filter Controls */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Assignee Filter */}
              <div>
                <label htmlFor="assignee-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Assignee
                </label>
                <select
                  id="assignee-filter"
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Assignees</option>
                  {uniqueAssignees.map(assignee => (
                    <option key={assignee} value={assignee}>
                      {assignee}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Status Filter */}
              <div>
                <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Status
                </label>
                <input
                  id="status-filter"
                  type="text"
                  placeholder="Search status..."
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discovery Start Date Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    placeholder="Start date"
                    value={dateRangeFilter.start}
                    onChange={(e) => setDateRangeFilter(prev => ({ ...prev, start: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="date"
                    placeholder="End date"
                    value={dateRangeFilter.end}
                    onChange={(e) => setDateRangeFilter(prev => ({ ...prev, end: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            
            {/* Clear Filters Button */}
            {(assigneeFilter || statusFilter || dateRangeFilter.start || dateRangeFilter.end) && (
              <div className="mt-3">
                <button
                  onClick={() => {
                    setAssigneeFilter('');
                    setStatusFilter('');
                    setDateRangeFilter({ start: '', end: '' });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
          
          {/* Gantt Chart */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Discovery Cycle Timeline</h3>
            <GanttChart key={`gantt-${assigneeFilter}-${ganttData.length}`} data={ganttData} height={400} />
          </div>
          
          {filteredDetails.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {discoveryDetails.length === 0 
                ? 'No discovery projects found' 
                : 'No projects match the current filters'
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('assignee')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Assignee</span>
                        {getSortIcon('assignee')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('currentStatus')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Current Status</span>
                        {getSortIcon('currentStatus')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('discoveryStartDate')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Discovery Start Date</span>
                        {getSortIcon('discoveryStartDate')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('activeDaysInDiscovery')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Active Days in Discovery</span>
                        {getSortIcon('activeDaysInDiscovery')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('calendarDaysInDiscovery')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Calendar Days in Discovery</span>
                        {getSortIcon('calendarDaysInDiscovery')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('endDateLogic')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>End Date Logic</span>
                        {getSortIcon('endDateLogic')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getSortedDetails().map((project) => (
                    <tr key={project.key} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        <a 
                          href={project.jiraUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {project.key}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {project.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.assignee}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.currentStatus}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(project.discoveryStartDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.activeDaysInDiscovery !== null ? `${project.activeDaysInDiscovery} days` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.calendarDaysInDiscovery !== null ? `${project.calendarDaysInDiscovery} days` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {project.endDateLogic}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
