'use client';

import { useState, useEffect } from 'react';

interface ProjectAtRisk {
  key: string;
  name: string;
  assignee: string;
  currentHealth: string;
  currentStatus: string;
  firstRiskDate: string | null;
  riskHistory: string;
  riskHistoryDetails: Array<{date: string, health: string, emoji: string}>;
  jiraUrl: string;
}

type SortField = 'assignee' | 'currentHealth' | 'currentStatus';
type SortDirection = 'asc' | 'desc';

export default function ProjectsAtRiskPage() {
  const [projectsAtRisk, setProjectsAtRisk] = useState<ProjectAtRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchProjectsAtRisk = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects-at-risk`);
      const result = await response.json();
      
      if (result.success) {
        setProjectsAtRisk(result.data);
      } else {
        setError(result.error || 'Failed to fetch projects at risk data');
      }
    } catch (err) {
      setError('Network error fetching data');
    } finally {
      setLoading(false);
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

  const toggleRowExpansion = (projectKey: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(projectKey)) {
      newExpandedRows.delete(projectKey);
    } else {
      newExpandedRows.add(projectKey);
    }
    setExpandedRows(newExpandedRows);
  };

  const getSortedProjects = () => {
    if (!sortField) return projectsAtRisk;

    return [...projectsAtRisk].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'assignee':
          aValue = a.assignee;
          bValue = b.assignee;
          break;
        case 'currentHealth':
          aValue = a.currentHealth;
          bValue = b.currentHealth;
          break;
        case 'currentStatus':
          aValue = a.currentStatus;
          bValue = b.currentStatus;
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

  useEffect(() => {
    fetchProjectsAtRisk();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading projects at risk...</div>
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
              onClick={fetchProjectsAtRisk}
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
              Projects At Risk
            </h2>
            <button
              onClick={fetchProjectsAtRisk}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
          
          {projectsAtRisk.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No projects currently at risk
            </div>
          ) : (
            <div>
              {/* Risk History Legend */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Risk History Legend</h3>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <span>🟢</span>
                    <span className="text-gray-600">On Track</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>🟡</span>
                    <span className="text-gray-600">At Risk</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>🔴</span>
                    <span className="text-gray-600">Off Track</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>⏸️</span>
                    <span className="text-gray-600">On Hold</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>✅</span>
                    <span className="text-gray-600">Complete</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>🟣</span>
                    <span className="text-gray-600">Mystery</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>⚪️</span>
                    <span className="text-gray-600">Unknown</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Hover over the risk history to see dates and details
                </p>
              </div>
              
              <div className="space-y-2">
                {getSortedProjects().map((project) => {
                  const isExpanded = expandedRows.has(project.key);
                  return (
                    <div key={project.key} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                      {/* Main row - always visible */}
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleRowExpansion(project.key)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-6 flex-1 min-w-0">
                            {/* Key */}
                            <div className="w-20 flex-shrink-0">
                              <a 
                                href={project.jiraUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-blue-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {project.key}
                              </a>
                            </div>
                            
                            {/* Name */}
                            <div className="flex-1 min-w-0 max-w-sm">
                              <p className="text-sm text-gray-900 truncate" title={project.name}>
                                {project.name}
                              </p>
                            </div>
                            
                            {/* Assignee */}
                            <div className="w-40 flex-shrink-0">
                              <p className="text-sm text-gray-900 truncate" title={project.assignee}>
                                {project.assignee}
                              </p>
                            </div>
                            
                            {/* Current Health */}
                            <div className="w-20 flex-shrink-0">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                project.currentHealth === 'At Risk' 
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : project.currentHealth === 'Off Track'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {project.currentHealth}
                              </span>
                            </div>
                            
                            {/* Current Status */}
                            <div className="w-48 flex-shrink-0">
                              <p className="text-sm text-gray-900 truncate" title={project.currentStatus}>
                                {project.currentStatus}
                              </p>
                            </div>
                          </div>
                          
                          {/* Expand/Collapse Icon */}
                          <div className="flex-shrink-0 ml-4">
                            <svg 
                              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      
                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* First Risk Date */}
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">First Risk Date</h4>
                              <p className="text-sm text-gray-900">
                                {project.firstRiskDate 
                                  ? new Date(project.firstRiskDate).toLocaleDateString()
                                  : 'Unknown'
                                }
                              </p>
                            </div>
                            
                            {/* Risk History */}
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Risk History</h4>
                              <div className="flex items-center space-x-1">
                                <span className="text-lg" title={project.riskHistoryDetails.map(h => 
                                  `${h.health} (${new Date(h.date).toLocaleDateString()})`
                                ).join(', ')}>
                                  {project.riskHistory}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Hover to see dates and details
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
