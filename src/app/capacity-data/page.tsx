'use client';

import { useState, useEffect } from 'react';

interface CapacitySnapshot {
  date: string;
  adam: number | null;
  jennie: number | null;
  jacqueline: number | null;
  robert: number | null;
  garima: number | null;
  lizzy: number | null;
  sanela: number | null;
  total: number | null;
  notes: string | null;
  hasIndividualCounts: boolean;
}

interface CapacityDataResponse {
  success: boolean;
  diagnostic: {
    totalSnapshots: number;
    currentWeekStart: string;
    hasCurrentWeekSnapshot: boolean;
    currentWeekSnapshot: CapacitySnapshot | null;
    mostRecentSnapshot: CapacitySnapshot | null;
    allSnapshots: CapacitySnapshot[];
  };
}

export default function CapacityDataPage() {
  const [data, setData] = useState<CapacityDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/debug-capacity-data');
      const result = await response.json();
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Capacity Data Table</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Capacity Data Table</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error: {error}</p>
            <button
              onClick={fetchData}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { diagnostic } = data;
  const sortedSnapshots = [...diagnostic.allSnapshots].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Capacity Data Table</h1>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Snapshots:</span>
              <span className="ml-2 font-semibold">{diagnostic.totalSnapshots}</span>
            </div>
            <div>
              <span className="text-gray-600">Current Week:</span>
              <span className="ml-2 font-semibold">{diagnostic.currentWeekStart}</span>
            </div>
            <div>
              <span className="text-gray-600">Has Current Week:</span>
              <span className={`ml-2 font-semibold ${diagnostic.hasCurrentWeekSnapshot ? 'text-green-600' : 'text-red-600'}`}>
                {diagnostic.hasCurrentWeekSnapshot ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Most Recent:</span>
              <span className="ml-2 font-semibold">
                {diagnostic.mostRecentSnapshot?.date || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adam
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jennie
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jacqueline
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Robert
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Garima
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lizzy
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sanela
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedSnapshots.map((snapshot, index) => {
                  const isCurrentWeek = snapshot.date === diagnostic.currentWeekStart;
                  const hasCounts = snapshot.hasIndividualCounts;
                  const sumOfCounts = (snapshot.adam || 0) + 
                                     (snapshot.jennie || 0) + 
                                     (snapshot.jacqueline || 0) + 
                                     (snapshot.robert || 0) + 
                                     (snapshot.garima || 0) + 
                                     (snapshot.lizzy || 0) + 
                                     (snapshot.sanela || 0);
                  const matchesTotal = sumOfCounts === (snapshot.total || 0);

                  return (
                    <tr 
                      key={snapshot.date} 
                      className={isCurrentWeek ? 'bg-blue-50' : ''}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {snapshot.date}
                        {isCurrentWeek && (
                          <span className="ml-2 text-xs text-blue-600">(Current Week)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {snapshot.adam != null ? snapshot.adam : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {snapshot.jennie != null ? snapshot.jennie : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {snapshot.jacqueline != null ? snapshot.jacqueline : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {snapshot.robert != null ? snapshot.robert : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {snapshot.garima != null ? snapshot.garima : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {snapshot.lizzy != null ? snapshot.lizzy : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {snapshot.sanela != null ? snapshot.sanela : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                        {snapshot.total != null ? snapshot.total : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={snapshot.notes || ''}>
                        {snapshot.notes || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        {hasCounts ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Total Only
                          </span>
                        )}
                        {hasCounts && !matchesTotal && (
                          <span className="ml-1 text-xs text-red-600" title={`Sum of counts (${sumOfCounts}) doesn't match total (${snapshot.total})`}>
                            ⚠️
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-600">
            <div>
              <span className="inline-block w-3 h-3 bg-blue-50 border border-blue-200 rounded mr-2"></span>
              Current week snapshot
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">Complete</span>
              Has individual team member counts
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mr-2">Total Only</span>
              Only has total count, missing individual counts
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

