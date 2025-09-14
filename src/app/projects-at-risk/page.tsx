'use client';

import { useState, useEffect } from 'react';

interface ProjectAtRisk {
  key: string;
  name: string;
  assignee: string;
  currentHealth: string;
  currentStatus: string;
  weeksAtRisk: number;
  bizChamp: string;
  jiraUrl: string;
}

type SortField = 'assignee' | 'currentHealth' | 'currentStatus' | 'weeksAtRisk' | 'bizChamp';
type SortDirection = 'asc' | 'desc';

export default function ProjectsAtRiskPage() {
  const [projectsAtRisk, setProjectsAtRisk] = useState<ProjectAtRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const fetchProjectsAtRisk = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://jira-dashboard-5kcaaaix5-adam-sigels-projects-2bc3f53e.vercel.app'
        : '';
      const response = await fetch(`${baseUrl}/api/projects-at-risk`);
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
        case 'weeksAtRisk':
          aValue = a.weeksAtRisk;
          bValue = b.weeksAtRisk;
          break;
        case 'bizChamp':
          aValue = a.bizChamp;
          bValue = b.bizChamp;
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
                      onClick={() => handleSort('currentHealth')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Current Health</span>
                        {getSortIcon('currentHealth')}
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
                      onClick={() => handleSort('weeksAtRisk')}
                    >
                      <div className="flex items-center space-x-1">
                        <span># of Weeks at Risk</span>
                        {getSortIcon('weeksAtRisk')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('bizChamp')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Biz Champ</span>
                        {getSortIcon('bizChamp')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getSortedProjects().map((project) => (
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          project.currentHealth === 'At Risk' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : project.currentHealth === 'Off Track'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {project.currentHealth}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.currentStatus}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.weeksAtRisk}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {project.bizChamp}
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
