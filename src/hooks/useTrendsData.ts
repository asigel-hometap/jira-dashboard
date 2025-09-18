import { useState, useEffect, useCallback, useMemo } from 'react';

interface DataContext {
  lastUpdated: Date;
  dataSource: string;
}

export function useTrendsData() {
  const [trendsData, setTrendsData] = useState<Record<string, number[]> | null>(null);
  const [dataContext, setDataContext] = useState<DataContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDataContext = useCallback(async () => {
    try {
      const response = await fetch('/api/data-context');
      const result = await response.json();
      
      if (result.success) {
        setDataContext(result.data);
      }
    } catch (err) {
      console.error('Error fetching data context:', err);
    }
  }, []);

  const fetchTrendsData = useCallback(async () => {
    try {
      const response = await fetch('/api/extended-trends');
      const result = await response.json();
      
      if (result.success) {
        setTrendsData(result.data);
      }
    } catch (err) {
      console.error('Error fetching extended trends data:', err);
      setError('Failed to fetch trends data');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchTrendsData(),
        fetchDataContext()
      ]);
      setLoading(false);
    };
    
    loadData();
  }, [fetchTrendsData, fetchDataContext]);

  // Memoized team member names to prevent unnecessary re-renders
  const teamMemberNames = useMemo(() => {
    return ['Adam Sigel', 'Jennie Goldenberg', 'Jacqueline Gallagher', 'Robert J. Johnson', 'Garima Giri', 'Lizzy Magill', 'Sanela Smaka'];
  }, []);

  // Calculate the global maximum project count across all team members for Y-axis normalization
  const globalMaxProjects = useMemo(() => {
    if (!trendsData) {
      return 0;
    }

    let max = 0;
    const teamMemberKeys = ['adam', 'jennie', 'jacqueline', 'robert', 'garima', 'lizzy', 'sanela'];
    
    teamMemberKeys.forEach(key => {
      const data = trendsData[key as keyof typeof trendsData];
      if (Array.isArray(data) && data.length > 0) {
        const memberMax = Math.max(...data);
        if (memberMax > max) {
          max = memberMax;
        }
      }
    });
    
    // Add a small buffer to the max for better visual spacing
    return max > 0 ? max + 1 : 1; // Ensure min 1 if all are 0
  }, [trendsData]);

  // Memoized trend data calculation to prevent infinite re-renders
  const trendDataMap = useMemo(() => {
    if (!trendsData) {
      return new Map();
    }
    
    const nameMap: { [key: string]: string } = {
      'Adam Sigel': 'adam',
      'Jennie Goldenberg': 'jennie',
      'Jacqueline Gallagher': 'jacqueline',
      'Robert J. Johnson': 'robert',
      'Garima Giri': 'garima',
      'Lizzy Magill': 'lizzy',
      'Sanela Smaka': 'sanela'
    };
    
    const map = new Map();
    
    teamMemberNames.forEach((teamMember) => {
      const key = nameMap[teamMember];
      if (!key) {
        map.set(teamMember, { data: [], dates: [] });
        return;
      }
      
      const data = trendsData[key as keyof typeof trendsData];
      const dates = trendsData.dates || [];
      
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'number') {
        const filteredData = data as number[];
        const filteredDates = dates as unknown as string[];
        
        map.set(teamMember, { data: filteredData, dates: filteredDates });
      } else {
        map.set(teamMember, { data: [], dates: [] });
      }
    });
    
    return map;
  }, [trendsData, teamMemberNames]);

  return {
    trendsData,
    dataContext,
    loading,
    error,
    teamMemberNames,
    globalMaxProjects,
    trendDataMap,
    refetch: fetchTrendsData
  };
}
