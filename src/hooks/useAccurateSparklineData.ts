import { useState, useEffect, useCallback } from 'react';

// Team member name mapping
const TEAM_MEMBERS = {
  'Adam Sigel': 'adam',
  'Jennie Goldenberg': 'jennie',
  'Jacqueline Gallagher': 'jacqueline',
  'Robert J. Johnson': 'robert',
  'Garima Giri': 'garima',
  'Lizzy Magill': 'lizzy',
  'Sanela Smaka': 'sanela'
} as const;

function getMemberKey(teamMember: string): string {
  return TEAM_MEMBERS[teamMember as keyof typeof TEAM_MEMBERS] || 'unknown';
}

interface SparklineData {
  data: number[];
  dates: string[];
  dataSource: string[];
  errorWeeks: number;
  totalWeeks: number;
}

interface UseAccurateSparklineDataReturn {
  data: SparklineData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

export function useAccurateSparklineData(teamMember: string): UseAccurateSparklineDataReturn {
  const [data, setData] = useState<SparklineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch('/api/accurate-sparkline', {
        method: isRefresh ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch sparkline data');
      }

      // Extract data for the specific team member
      const memberKey = getMemberKey(teamMember);
      const memberData = result.data.snapshots.map((snapshot: any) => ({
        value: snapshot[memberKey] || 0,
        date: snapshot.date,
        dataSource: snapshot.dataSource,
        error: snapshot.error
      }));

      const sparklineData: SparklineData = {
        data: memberData.map((d: any) => d.value),
        dates: memberData.map((d: any) => d.date),
        dataSource: memberData.map((d: any) => d.dataSource),
        errorWeeks: result.data.errorWeeks,
        totalWeeks: result.data.totalWeeks
      };

      setData(sparklineData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching accurate sparkline data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [teamMember]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh,
    isRefreshing
  };
}
