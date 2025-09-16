'use client';

import { useState, useEffect } from 'react';

interface CacheProgress {
  progress: {
    totalIssues: number;
    cachedCount: number;
    uncachedCount: number;
    progressPercentage: number;
    lastUpdated: string;
  };
  quarterDistribution: Array<{ quarter: string; count: number }>;
  statusDistribution: Array<{ value: string; count: number }>;
  sampleUncached: Array<{ key: string; status: string; created: string; summary: string }>;
  sampleCached: Array<{ key: string; endDateLogic: string; completionQuarter: string; calendarDays: number }>;
}

interface CacheStatus {
  isRunning: boolean;
  progress: CacheProgress | null;
  error: string | null;
}

interface IssueDetailCoverage {
  summary: {
    totalJiraIssues: number;
    totalDbIssues: number;
    totalCachedIssues: number;
    completeDetails: number;
    partialDetails: number;
    noDetails: number;
  };
  coverage: {
    dbCoverage: number;
    cacheCoverage: number;
    completeCoverage: number;
  };
  missingFromDb: Array<{ key: string; status: string; summary: string }>;
  cachedButMissingFromDb: Array<{ key: string; endDateLogic: string }>;
  noDetails: Array<{ key: string; status: string; summary: string }>;
}

export default function CacheManagement() {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    isRunning: false,
    progress: null,
    error: null
  });
  const [coverage, setCoverage] = useState<IssueDetailCoverage | null>(null);

  const [selectedStrategy, setSelectedStrategy] = useState<'systematic' | 'fast'>('systematic');
  const [waitTime, setWaitTime] = useState(15);
  const [batchSize, setBatchSize] = useState(5);
  const [startFromIssue, setStartFromIssue] = useState(1);

  const fetchProgress = async () => {
    try {
      const response = await fetch('/api/processing-status-cached');
      const data = await response.json();
      
      if (data.success) {
        setCacheStatus(prev => ({
          ...prev,
          progress: data.data,
          error: null
        }));
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  };

  const fetchCoverage = async () => {
    try {
      const response = await fetch('/api/issue-detail-coverage');
      const data = await response.json();
      
      if (data.success) {
        setCoverage(data.data);
      }
    } catch (error) {
      console.error('Error fetching coverage:', error);
    }
  };

  const syncMissingIssues = async () => {
    try {
      setCacheStatus(prev => ({ ...prev, isRunning: true, error: null }));
      
      const response = await fetch('/api/sync-missing-issues', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        await fetchCoverage();
        setCacheStatus(prev => ({ ...prev, isRunning: false }));
      } else {
        setCacheStatus(prev => ({ 
          ...prev, 
          isRunning: false, 
          error: data.error || 'Failed to sync missing issues' 
        }));
      }
    } catch (error) {
      setCacheStatus(prev => ({ 
        ...prev, 
        isRunning: false, 
        error: error instanceof Error ? error.message : 'Failed to sync missing issues' 
      }));
    }
  };

  const syncCachedIssues = async () => {
    try {
      setCacheStatus(prev => ({ ...prev, isRunning: true, error: null }));
      
      const response = await fetch('/api/sync-cached-issues', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        await fetchCoverage();
        setCacheStatus(prev => ({ ...prev, isRunning: false }));
      } else {
        setCacheStatus(prev => ({ 
          ...prev, 
          isRunning: false, 
          error: data.error || 'Failed to sync cached issues' 
        }));
      }
    } catch (error) {
      setCacheStatus(prev => ({ 
        ...prev, 
        isRunning: false, 
        error: error instanceof Error ? error.message : 'Failed to sync cached issues' 
      }));
    }
  };

  const forceRebuildProjectDetails = async () => {
    try {
      setCacheStatus(prev => ({ ...prev, isRunning: true, error: null }));
      
      // Get all quarters from cycle time cache to rebuild project details for each
      const response = await fetch('/api/cycle-time-analysis');
      const data = await response.json();
      
      if (data.success && data.data.quarters) {
        const quarters = data.data.quarters.map((q: any) => q.quarter);
        let totalRebuilt = 0;
        
        for (const quarter of quarters) {
          console.log(`Rebuilding project details for ${quarter}...`);
          const rebuildResponse = await fetch(`/api/cycle-time-details?quarter=${quarter}&force_rebuild=true`);
          const rebuildData = await rebuildResponse.json();
          
          if (rebuildData.success) {
            totalRebuilt += rebuildData.data.length;
            console.log(`Rebuilt ${rebuildData.data.length} projects for ${quarter}`);
          }
        }
        
        setCacheStatus(prev => ({ 
          ...prev, 
          isRunning: false,
          error: null
        }));
        
        // Show success message
        alert(`Successfully rebuilt project details cache for ${quarters.length} quarters with ${totalRebuilt} total projects`);
      } else {
        setCacheStatus(prev => ({ 
          ...prev, 
          isRunning: false, 
          error: 'Failed to get quarters for rebuild' 
        }));
      }
    } catch (error) {
      setCacheStatus(prev => ({ 
        ...prev, 
        isRunning: false, 
        error: error instanceof Error ? error.message : 'Failed to rebuild project details cache' 
      }));
    }
  };

  const startCachePopulation = async () => {
    setCacheStatus(prev => ({ ...prev, isRunning: true, error: null }));
    
    try {
      const endpoint = selectedStrategy === 'systematic' 
        ? '/api/process-all-issues-systematic' 
        : '/api/process-all-issues-fast';
      
      const body = {
        waitTime,
        batchSize: selectedStrategy === 'systematic' ? 1 : batchSize,
        startFromIssue
      };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchProgress();
        setCacheStatus(prev => ({ ...prev, isRunning: false }));
      } else {
        setCacheStatus(prev => ({ 
          ...prev, 
          isRunning: false, 
          error: data.error || 'Unknown error occurred' 
        }));
      }
    } catch (error) {
      setCacheStatus(prev => ({ 
        ...prev, 
        isRunning: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }));
    }
  };

  const clearProjectDetailsCache = async () => {
    if (!confirm('Clear project details cache? This will force rebuilding of quarter-specific project details but preserve the main cycle time cache.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/clear-all-project-details-cache', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        await fetchProgress();
        alert('Project details cache cleared successfully. Quarter details will be rebuilt on next access.');
      } else {
        setCacheStatus(prev => ({ 
          ...prev, 
          error: data.error || 'Failed to clear project details cache' 
        }));
      }
    } catch (error) {
      setCacheStatus(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to clear project details cache' 
      }));
    }
  };

  const clearCache = async () => {
    const cacheCount = cacheStatus.progress?.progress?.cachedCount || 0;
    
    if (!confirm(`⚠️ DANGER: This will permanently delete ALL cached data (${cacheCount} issues).\n\nThis action cannot be undone and will require rebuilding the entire cache.\n\nType "DELETE ALL CACHE" to confirm:`)) {
      return;
    }
    
    const confirmation = prompt('Type "DELETE ALL CACHE" to confirm this destructive action:');
    if (confirmation !== 'DELETE ALL CACHE') {
      alert('Cache clear cancelled - confirmation text did not match');
      return;
    }
    
    try {
      const response = await fetch('/api/clear-cache', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        await fetchProgress();
        alert(`Cache cleared successfully. ${cacheCount} issues will need to be reprocessed.`);
      } else {
        setCacheStatus(prev => ({ 
          ...prev, 
          error: data.error || 'Failed to clear cache' 
        }));
      }
    } catch (error) {
      setCacheStatus(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to clear cache' 
      }));
    }
  };

  useEffect(() => {
    fetchProgress();
    fetchCoverage();
    const interval = setInterval(() => {
      fetchProgress();
      fetchCoverage();
    }, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const validateWaitTime = (value: number) => {
    return Math.max(5, Math.min(60, value));
  };

  const validateBatchSize = (value: number) => {
    return Math.max(1, Math.min(20, value));
  };

  const validateStartFromIssue = (value: number) => {
    return Math.max(1, Math.min(522, value));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Cache Management</h1>
          
          {/* Strategy Selection */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Processing Strategy</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                className={`p-6 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedStrategy === 'systematic' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedStrategy('systematic')}
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Process All Issues (Systematic)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Processes all issues one by one with configurable delays. Most reliable but slower.
                </p>
                <div className="text-xs text-gray-500">
                  <p>• Rate: 4 issues per minute (15s delay)</p>
                  <p>• ETA: ~2.2 hours for all 522 issues</p>
                  <p>• Best for: Complete, reliable processing</p>
                </div>
              </div>
              
              <div 
                className={`p-6 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedStrategy === 'fast' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedStrategy('fast')}
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Process All Issues (Fast)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Processes issues in parallel batches. Faster but uses more API calls.
                </p>
                <div className="text-xs text-gray-500">
                  <p>• Rate: 5 issues per 1.25 minutes</p>
                  <p>• ETA: ~1.5 hours for all 522 issues</p>
                  <p>• Best for: Quick processing with higher API usage</p>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Parameters */}
          <div className="mb-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Wait Time (seconds)
                </label>
                <input
                  type="number"
                  value={waitTime}
                  onChange={(e) => setWaitTime(validateWaitTime(parseInt(e.target.value) || 15))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="5"
                  max="60"
                />
                <p className="text-xs text-gray-500 mt-1">Range: 5-60 seconds</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Size
                </label>
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(validateBatchSize(parseInt(e.target.value) || 5))}
                  disabled={selectedStrategy === 'systematic'}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    selectedStrategy === 'systematic' ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  min="1"
                  max="20"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {selectedStrategy === 'systematic' ? 'Fixed at 1 for systematic processing' : 'Range: 1-20 issues per batch'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start From Issue
                </label>
                <input
                  type="number"
                  value={startFromIssue}
                  onChange={(e) => setStartFromIssue(validateStartFromIssue(parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="522"
                />
                <p className="text-xs text-gray-500 mt-1">Range: 1-522 (1 = start from beginning)</p>
              </div>
            </div>
            
            {/* Processing Summary */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Processing Summary</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>Strategy:</strong> {selectedStrategy === 'systematic' ? 'Systematic (one-by-one)' : 'Fast (parallel batches)'}</p>
                <p><strong>Wait Time:</strong> {waitTime} seconds {selectedStrategy === 'systematic' ? 'between issues' : 'between batches'}</p>
                <p><strong>Batch Size:</strong> {selectedStrategy === 'systematic' ? '1' : batchSize} issues per batch</p>
                <p><strong>Starting Point:</strong> Issue #{startFromIssue}</p>
                <p><strong>Estimated Rate:</strong> {selectedStrategy === 'systematic' ? '4' : Math.round(60 / (waitTime / 60) * batchSize)} issues per minute</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mb-8 flex flex-wrap gap-4">
            <button
              onClick={startCachePopulation}
              disabled={cacheStatus.isRunning}
              className={`px-8 py-3 rounded-lg font-semibold transition-colors ${
                cacheStatus.isRunning
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {cacheStatus.isRunning ? 'Processing...' : 'Start Processing'}
            </button>
            
            <button
              onClick={fetchProgress}
              disabled={cacheStatus.isRunning}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Refresh Status
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={clearProjectDetailsCache}
                disabled={cacheStatus.isRunning}
                className="px-4 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Clear Project Details Cache
              </button>
              <button
                onClick={clearCache}
                disabled={cacheStatus.isRunning}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Clear ALL Cache (DANGER)
              </button>
            </div>
          </div>

          {/* Error Display */}
          {cacheStatus.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Error</h3>
              <p className="text-red-700">{cacheStatus.error}</p>
            </div>
          )}

          {/* Progress Display */}
          {cacheStatus.progress && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">Total Cached</h3>
                  <p className="text-2xl font-bold text-blue-900">{cacheStatus.progress.progress?.cachedCount || 0}</p>
                  <p className="text-sm text-blue-600">of {cacheStatus.progress.progress?.totalIssues || 0} issues</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">Completed Cycles</h3>
                  <p className="text-2xl font-bold text-green-900">
                    {cacheStatus.progress.statusDistribution
                      ?.find(item => item.value === 'Build Transition')?.count || 0}
                  </p>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-orange-800 mb-2">Progress</h3>
                  <p className="text-2xl font-bold text-orange-900">{cacheStatus.progress.progress?.progressPercentage || 0}%</p>
                  <div className="w-full bg-orange-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-orange-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${cacheStatus.progress.progress?.progressPercentage || 0}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">Uncached</h3>
                  <p className="text-2xl font-bold text-purple-900">{cacheStatus.progress.progress?.uncachedCount || 0}</p>
                  <p className="text-sm text-purple-600">remaining</p>
                </div>
              </div>

              {/* Quarter Distribution */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Quarter Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {cacheStatus.progress.quarterDistribution?.map((quarter) => (
                    <div key={quarter.quarter} className="bg-gray-50 p-4 rounded-lg text-center">
                      <p className="font-semibold text-gray-800">{quarter.quarter}</p>
                      <p className="text-2xl font-bold text-gray-900">{quarter.count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Distribution */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Distribution</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cacheStatus.progress.statusDistribution?.map((item) => (
                    <div key={item.value} className="bg-gray-50 p-4 rounded-lg">
                      <p className="font-semibold text-gray-800">{item.value}</p>
                      <p className="text-xl font-bold text-gray-900">{item.count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Uncached Issues */}
              {cacheStatus.progress.sampleUncached && cacheStatus.progress.sampleUncached.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Sample Uncached Issues</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {cacheStatus.progress.sampleUncached.map((issue, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-mono text-yellow-800">{issue.key}</span>
                          <span className="text-yellow-600 ml-2">({issue.status})</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-yellow-600 mt-2">
                      Showing first 10 of {cacheStatus.progress.progress?.uncachedCount || 0} uncached issues
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Issue Detail Coverage */}
          {coverage && (
            <div className="mt-8 space-y-6">
              <h2 className="text-xl font-semibold text-gray-800">Issue Detail Coverage</h2>
              
              {/* Coverage Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">Complete Details</h3>
                  <p className="text-2xl font-bold text-green-900">{coverage.summary.completeDetails}</p>
                  <p className="text-sm text-green-600">{coverage.coverage.completeCoverage}% coverage</p>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-yellow-800 mb-2">Partial Details</h3>
                  <p className="text-2xl font-bold text-yellow-900">{coverage.summary.partialDetails}</p>
                  <p className="text-sm text-yellow-600">Cached but missing from DB</p>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-red-800 mb-2">No Details</h3>
                  <p className="text-2xl font-bold text-red-900">{coverage.summary.noDetails}</p>
                  <p className="text-sm text-red-600">Not cached yet</p>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">Database Coverage</h3>
                  <p className="text-2xl font-bold text-blue-900">{coverage.coverage.dbCoverage}%</p>
                  <p className="text-sm text-blue-600">{coverage.summary.totalDbIssues} of {coverage.summary.totalJiraIssues} issues</p>
                </div>
              </div>

              {/* Cache Management Actions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Cache Management Actions</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Sync Missing Issues */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-blue-800">Sync Missing Issues</h4>
                      <button
                        onClick={syncMissingIssues}
                        disabled={cacheStatus.isRunning}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        Sync
                      </button>
                    </div>
                    <p className="text-sm text-blue-700 mb-2">
                      Finds issues that exist in Jira but are missing from your database and syncs them.
                    </p>
                    <p className="text-xs text-blue-600">
                      <strong>Use when:</strong> You see &quot;Issues Missing from Database&quot; below, or when new projects aren&apos;t appearing in the dashboard.
                    </p>
                  </div>

                  {/* Sync Cached Issues */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-green-800">Sync Cached Issues</h4>
                      <button
                        onClick={syncCachedIssues}
                        disabled={cacheStatus.isRunning}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        Sync
                      </button>
                    </div>
                    <p className="text-sm text-green-700 mb-2">
                      Finds issues that have cycle time data cached but are missing from your database.
                    </p>
                    <p className="text-xs text-green-600">
                      <strong>Use when:</strong> You see &quot;Cached but Missing from Database&quot; below, or when cycle time analysis shows incomplete data.
                    </p>
                  </div>

                  {/* Force Rebuild Project Details */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-purple-800">Rebuild Project Details</h4>
                      <button
                        onClick={forceRebuildProjectDetails}
                        disabled={cacheStatus.isRunning}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        Rebuild
                      </button>
                    </div>
                    <p className="text-sm text-purple-700 mb-2">
                      Rebuilds the project details cache from cycle time data for all quarters.
                    </p>
                    <p className="text-xs text-purple-600">
                      <strong>Use when:</strong> Cycle time analysis shows fewer projects than expected (e.g., n=34 but only 1 project visible), or after major data updates.
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Quality Issues */}
              {(coverage.missingFromDb.length > 0 || coverage.cachedButMissingFromDb.length > 0) && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Data Quality Issues</h3>
                  
                  {coverage.missingFromDb.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-orange-800 mb-2">
                        Issues Missing from Database ({coverage.missingFromDb.length} total)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {coverage.missingFromDb.slice(0, 10).map((issue, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-mono text-orange-800">{issue.key}</span>
                            <span className="text-orange-600 ml-2">({issue.status})</span>
                            <div className="text-xs text-orange-600 truncate">{issue.summary}</div>
                          </div>
                        ))}
                      </div>
                      {coverage.missingFromDb.length > 10 && (
                        <p className="text-xs text-orange-600 mt-2">
                          Showing first 10 of {coverage.missingFromDb.length} missing issues
                        </p>
                      )}
                    </div>
                  )}
                  
                  {coverage.cachedButMissingFromDb.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-800 mb-2">
                        Cached but Missing from Database ({coverage.cachedButMissingFromDb.length} total)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {coverage.cachedButMissingFromDb.slice(0, 10).map((issue, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-mono text-yellow-800">{issue.key}</span>
                            <span className="text-yellow-600 ml-2">({issue.endDateLogic})</span>
                          </div>
                        ))}
                      </div>
                      {coverage.cachedButMissingFromDb.length > 10 && (
                        <p className="text-xs text-yellow-600 mt-2">
                          Showing first 10 of {coverage.cachedButMissingFromDb.length} issues
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Running Indicator */}
          {cacheStatus.isRunning && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                <p className="text-blue-800 font-semibold">
                  Cache population in progress... This may take several minutes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}