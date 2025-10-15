import React, { useState, useEffect } from 'react';

interface CacheStatus {
  status: {
    level: 'healthy' | 'warning' | 'critical' | 'error';
    color: 'green' | 'yellow' | 'red';
    overallScore: number;
    lastChecked: string;
  };
  sync: {
    score: number;
    totalJiraIssues: number;
    totalDbIssues: number;
    missingFromDb: number;
    extraInDb: number;
    cacheProgress: number;
  };
  health: {
    score: number;
    discrepancies: number;
    breakdown: {
      onTrack: number;
      atRisk: number;
      offTrack: number;
      onHold: number;
      mystery: number;
      complete: number;
      unknown: number;
    };
  };
  distribution: {
    active: number;
    archived: number;
    missing: number;
    extra: number;
  };
  insights: {
    needsSync: boolean;
    needsHealthUpdate: boolean;
    hasExtraData: boolean;
    cacheComplete: boolean;
    recommendations: string[];
  };
  samples: {
    missingFromDb: Array<{ key: string; summary: string; assignee?: string }>;
    healthDiscrepancies: Array<{ key: string; jiraHealth: string; dbHealth: string }>;
    extraInDb: Array<{ key: string; summary: string; assignee?: string }>;
  };
}

const UnifiedCacheManagement: React.FC = () => {
  const [status, setStatus] = useState<CacheStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cache-status');
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching cache status:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (action: string) => {
    try {
      setActionLoading(action);
      const response = await fetch(`/api/${action}`, { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        // Refresh status after successful action
        await fetchStatus();
      } else {
        alert(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error running ${action}:`, error);
      alert(`Error running ${action}: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-red-600">Failed to load cache status</div>
      </div>
    );
  }

  const getStatusBadge = (level: string, color: string) => {
    const colorClasses = {
      green: 'bg-green-100 text-green-800 border-green-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      red: 'bg-red-100 text-red-800 border-red-200'
    };
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${colorClasses[color as keyof typeof colorClasses]}`}>
        {level.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Database Cache Management</h1>
          <div className="flex gap-3">
            <button
              onClick={() => runAction('sync-daily')}
              disabled={actionLoading === 'sync-daily'}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {actionLoading === 'sync-daily' ? 'Syncing...' : 'Daily Sync'}
            </button>
            <button
              onClick={() => runAction('sync-master')}
              disabled={actionLoading === 'sync-master'}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {actionLoading === 'sync-master' ? 'Syncing...' : 'Full Sync'}
            </button>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>

        {/* Overall Status */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Overall Status</h2>
            <p className="text-sm text-gray-600">Last checked: {new Date(status.status.lastChecked).toLocaleString()}</p>
          </div>
          <div className="text-right">
            {getStatusBadge(status.status.level, status.status.color)}
            <div className="text-2xl font-bold text-gray-900 mt-1">{status.status.overallScore}%</div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-blue-600 mb-1">Data Sync</div>
            <div className="text-2xl font-bold text-blue-900">{status.sync.score}%</div>
            <div className="text-sm text-blue-600">
              {status.sync.missingFromDb === 0 ? '0 missing' : `${status.sync.missingFromDb} missing`}
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-green-600 mb-1">Health Accuracy</div>
            <div className="text-2xl font-bold text-green-900">{status.health.score}%</div>
            <div className="text-sm text-green-600">
              {status.health.discrepancies === 0 ? '0 discrepancies' : `${status.health.discrepancies} discrepancies`}
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-purple-600 mb-1">Cache Progress</div>
            <div className="text-2xl font-bold text-purple-900">{status.sync.cacheProgress}%</div>
            <div className="text-sm text-purple-600">
              {status.sync.totalDbIssues} of {status.sync.totalJiraIssues} issues
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {status.insights.recommendations.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">Recommended Actions</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              {status.insights.recommendations.map((rec, index) => (
                <li key={index} className="flex items-center">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issue Distribution */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Issue Distribution</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Issues</span>
              <span className="font-medium text-green-600">{status.distribution.active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Archived Issues</span>
              <span className="font-medium text-gray-600">{status.distribution.archived}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Missing from DB</span>
              <span className="font-medium text-red-600">{status.distribution.missing}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Extra in DB</span>
              <span className="font-medium text-orange-600">{status.distribution.extra}</span>
            </div>
          </div>
        </div>

        {/* Health Breakdown */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Status Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">On Track</span>
              <span className="font-medium text-green-600">{status.health.breakdown.onTrack}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">At Risk</span>
              <span className="font-medium text-yellow-600">{status.health.breakdown.atRisk}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Off Track</span>
              <span className="font-medium text-red-600">{status.health.breakdown.offTrack}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">On Hold</span>
              <span className="font-medium text-purple-600">{status.health.breakdown.onHold}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Complete</span>
              <span className="font-medium text-gray-600">{status.health.breakdown.complete}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Unknown</span>
              <span className="font-medium text-gray-500">{status.health.breakdown.unknown}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sample Issues for Debugging */}
      {(status.samples.missingFromDb.length > 0 || status.samples.healthDiscrepancies.length > 0 || status.samples.extraInDb.length > 0) && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sample Issues (for debugging)</h3>
          
          {status.samples.missingFromDb.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-red-600 mb-2">Missing from Database:</h4>
              <div className="space-y-1">
                {status.samples.missingFromDb.map((issue, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    <span className="font-mono text-red-600">{issue.key}</span>: {issue.summary}
                    {issue.assignee && <span className="text-gray-500"> (assigned to {issue.assignee})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {status.samples.healthDiscrepancies.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-yellow-600 mb-2">Health Discrepancies:</h4>
              <div className="space-y-1">
                {status.samples.healthDiscrepancies.map((issue, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    <span className="font-mono text-yellow-600">{issue.key}</span>: Jira={issue.jiraHealth}, DB={issue.dbHealth}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {status.samples.extraInDb.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-orange-600 mb-2">Extra in Database:</h4>
              <div className="space-y-1">
                {status.samples.extraInDb.map((issue, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    <span className="font-mono text-orange-600">{issue.key}</span>: {issue.summary}
                    {issue.assignee && <span className="text-gray-500"> (assigned to {issue.assignee})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedCacheManagement;
