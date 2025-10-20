import { useState, useEffect, useCallback } from 'react';
import { WorkloadData } from '@/types/jira';

export function useWorkloadData() {
  const [workloadData, setWorkloadData] = useState<WorkloadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkloadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Use the new live API endpoint that fetches data directly from Jira
      const response = await fetch('/api/workload-live');
      const result = await response.json();
      
      if (result.success) {
        setWorkloadData(result.data);
      } else {
        setError(result.error || 'Failed to fetch workload data');
      }
    } catch {
      setError('Network error fetching data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkloadData();
  }, [fetchWorkloadData]);

  return {
    workloadData,
    loading,
    error,
    refetch: fetchWorkloadData
  };
}
