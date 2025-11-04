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
      
      // First try the weekly snapshot API endpoint
      const weeklyResponse = await fetch('/api/workload-weekly');
      const weeklyResult = await weeklyResponse.json();
      
      if (weeklyResult.success) {
        setWorkloadData(weeklyResult.data);
        return;
      }
      
      // If no snapshot exists, fall back to live data for now
      // This allows the page to load while we set up snapshots properly
      console.warn('Weekly snapshot not found, falling back to live data:', weeklyResult.error);
      
      if (weeklyResult.action === 'create_snapshot') {
        // Try live data as fallback
        const liveResponse = await fetch('/api/workload-live');
        const liveResult = await liveResponse.json();
        
        if (liveResult.success) {
          setWorkloadData(liveResult.data);
          setError('Using live data (no snapshot found). Please create a weekly snapshot for persistent counts.');
        } else {
          setError(weeklyResult.error || 'No weekly snapshot found. Please create a snapshot first.');
        }
      } else {
        setError(weeklyResult.error || 'Failed to fetch workload data');
      }
    } catch (err) {
      console.error('Error fetching workload data:', err);
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
