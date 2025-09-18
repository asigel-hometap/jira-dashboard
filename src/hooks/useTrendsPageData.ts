import { useState, useEffect, useCallback, useMemo } from 'react';

interface TrendData {
  week: string;
  totalProjects: number;
  healthBreakdown: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    onHold: number;
    mystery: number;
    complete: number;
    unknown: number;
  };
  statusBreakdown: {
    generativeDiscovery: number;
    problemDiscovery: number;
    solutionDiscovery: number;
    build: number;
    beta: number;
    live: number;
    wonDo: number;
    unknown: number;
  };
}

interface Filters {
  assignees: string[];
}

interface AvailableFilters {
  assignees: string[];
}

export function useTrendsPageData() {
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ assignees: [] });
  const [tempFilters, setTempFilters] = useState<Filters>({ assignees: [] });
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>({ assignees: [] });
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingText, setLoadingText] = useState('');

  const fetchTrendData = useCallback(async (currentFilters: Filters) => {
    try {
      setLoading(true);
      setError(null);
      setLoadingStep(0);
      
      // Start cycling text
      const cyclingTexts = [
        'Connecting to database...',
        'Loading project data...',
        'Analyzing historical trends...',
        'Processing health breakdowns...',
        'Calculating status distributions...',
        'Generating chart data...',
        'Almost ready...'
      ];
      
      let textIndex = 0;
      const textInterval = setInterval(() => {
        setLoadingText(cyclingTexts[textIndex]);
        textIndex = (textIndex + 1) % cyclingTexts.length;
      }, 800);
      
      // Simulate progress steps
      const stepInterval = setInterval(() => {
        setLoadingStep(prev => Math.min(prev + 1, 2));
      }, 2000);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (currentFilters.assignees.length > 0) {
        currentFilters.assignees.forEach(assignee => params.append('assignee', assignee));
      }
      
      const url = `/api/trends?${params.toString()}`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      // Clear intervals
      clearInterval(textInterval);
      clearInterval(stepInterval);
      
      if (result.success) {
        setTrendData(result.data.trendData);
        if (result.data.availableFilters) {
          setAvailableFilters(result.data.availableFilters);
        }
      } else {
        setError(result.error || 'Failed to fetch trend data');
      }
    } catch (err) {
      setError('Failed to fetch trend data');
      console.error('Error fetching trend data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Memoized chart data to prevent unnecessary re-renders
  const chartData = useMemo(() => {
    if (!trendData || trendData.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = trendData.map(week => week.week);
    
    // Health breakdown datasets
    const healthDatasets = [
      {
        label: 'On Track',
        data: trendData.map(week => week.healthBreakdown.onTrack),
        backgroundColor: '#10B981',
        borderColor: '#10B981',
      },
      {
        label: 'At Risk',
        data: trendData.map(week => week.healthBreakdown.atRisk),
        backgroundColor: '#F59E0B',
        borderColor: '#F59E0B',
      },
      {
        label: 'Off Track',
        data: trendData.map(week => week.healthBreakdown.offTrack),
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
      },
      {
        label: 'On Hold',
        data: trendData.map(week => week.healthBreakdown.onHold),
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
      },
      {
        label: 'Mystery',
        data: trendData.map(week => week.healthBreakdown.mystery),
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
      },
      {
        label: 'Complete',
        data: trendData.map(week => week.healthBreakdown.complete),
        backgroundColor: '#6B7280',
        borderColor: '#6B7280',
      },
      {
        label: 'Unknown',
        data: trendData.map(week => week.healthBreakdown.unknown),
        backgroundColor: '#9CA3AF',
        borderColor: '#9CA3AF',
      }
    ];

    // Status breakdown datasets
    const statusDatasets = [
      {
        label: 'Generative Discovery',
        data: trendData.map(week => week.statusBreakdown.generativeDiscovery),
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
      },
      {
        label: 'Problem Discovery',
        data: trendData.map(week => week.statusBreakdown.problemDiscovery),
        backgroundColor: '#F59E0B',
        borderColor: '#F59E0B',
      },
      {
        label: 'Solution Discovery',
        data: trendData.map(week => week.statusBreakdown.solutionDiscovery),
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
      },
      {
        label: 'Build',
        data: trendData.map(week => week.statusBreakdown.build),
        backgroundColor: '#10B981',
        borderColor: '#10B981',
      },
      {
        label: 'Beta',
        data: trendData.map(week => week.statusBreakdown.beta),
        backgroundColor: '#06B6D4',
        borderColor: '#06B6D4',
      },
      {
        label: 'Live',
        data: trendData.map(week => week.statusBreakdown.live),
        backgroundColor: '#059669',
        borderColor: '#059669',
      },
      {
        label: 'Won\'t Do',
        data: trendData.map(week => week.statusBreakdown.wonDo),
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
      },
      {
        label: 'Unknown',
        data: trendData.map(week => week.statusBreakdown.unknown),
        backgroundColor: '#9CA3AF',
        borderColor: '#9CA3AF',
      }
    ];

    return {
      labels,
      healthDatasets,
      statusDatasets
    };
  }, [trendData]);

  const handleApplyFilters = useCallback(() => {
    setFilters(tempFilters);
    fetchTrendData(tempFilters);
  }, [tempFilters, fetchTrendData]);

  const handleClearFilters = useCallback(() => {
    const clearedFilters = { assignees: [] };
    setTempFilters(clearedFilters);
    setFilters(clearedFilters);
    fetchTrendData(clearedFilters);
  }, [fetchTrendData]);

  const handleFilterChange = useCallback((key: keyof Filters, value: string[]) => {
    setTempFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    fetchTrendData(filters);
  }, [fetchTrendData, filters]);

  return {
    trendData,
    loading,
    error,
    filters,
    tempFilters,
    availableFilters,
    loadingStep,
    loadingText,
    chartData,
    handleApplyFilters,
    handleClearFilters,
    handleFilterChange,
    refetch: () => fetchTrendData(filters)
  };
}
