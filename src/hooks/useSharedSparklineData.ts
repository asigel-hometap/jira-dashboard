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

interface SharedSparklineResponse {
  snapshots: any[];
  memberData: Record<string, any[]>;
  totalWeeks: number;
  errorWeeks: number;
}

// Global shared state for sparkline data
let sharedData: SharedSparklineResponse | null = null;
let sharedLoading = false;
let sharedError: string | null = null;
const sharedListeners: Set<() => void> = new Set();
let sharedFetchPromise: Promise<void> | null = null;

async function fetchSharedSparklineData(forceRefresh = false): Promise<SharedSparklineResponse> {
  // Add cache-busting parameter if forcing refresh
  const url = forceRefresh 
    ? `/api/accurate-sparkline?t=${Date.now()}`
    : '/api/accurate-sparkline';
    
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: forceRefresh ? 'no-store' : 'default',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch sparkline data');
  }

  return {
    snapshots: result.data.snapshots || [],
    memberData: result.data.memberData || {},
    totalWeeks: result.data.totalWeeks || 0,
    errorWeeks: result.data.errorWeeks || 0
  };
}

function notifyListeners() {
  sharedListeners.forEach(listener => listener());
}

async function ensureSharedData(): Promise<void> {
  if (sharedData) {
    return; // Already loaded
  }

  if (sharedFetchPromise) {
    return sharedFetchPromise; // Already fetching
  }

  sharedLoading = true;
  sharedError = null;
  sharedFetchPromise = fetchSharedSparklineData()
    .then(data => {
      sharedData = data;
      sharedLoading = false;
      notifyListeners();
    })
    .catch(error => {
      sharedError = error instanceof Error ? error.message : 'Unknown error';
      sharedLoading = false;
      notifyListeners();
    })
    .finally(() => {
      sharedFetchPromise = null;
    });

  return sharedFetchPromise;
}

export function useSharedSparklineData(teamMember: string): {
  data: SparklineData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
} {
  const [, forceUpdate] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Subscribe to shared data changes
  useEffect(() => {
    const listener = () => {
      forceUpdate({});
    };
    sharedListeners.add(listener);

    // Ensure data is loaded - use cache-busting on initial load to avoid stale data
    if (!sharedData) {
      // First load - fetch fresh data
      sharedLoading = true;
      sharedError = null;
      fetchSharedSparklineData(true)
        .then(data => {
          sharedData = data;
          sharedLoading = false;
          notifyListeners();
        })
        .catch(error => {
          sharedError = error instanceof Error ? error.message : 'Unknown error';
          sharedLoading = false;
          notifyListeners();
        });
    } else {
      ensureSharedData();
    }

    return () => {
      sharedListeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Clear cached data to force refresh
      sharedData = null;
      sharedError = null;
      sharedFetchPromise = null;
      
      // Force fetch with cache-busting
      sharedLoading = true;
      sharedError = null;
      sharedFetchPromise = fetchSharedSparklineData(true)
        .then(data => {
          sharedData = data;
          sharedLoading = false;
          notifyListeners();
        })
        .catch(error => {
          sharedError = error instanceof Error ? error.message : 'Unknown error';
          sharedLoading = false;
          notifyListeners();
        })
        .finally(() => {
          sharedFetchPromise = null;
        });
      
      await sharedFetchPromise;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Extract data for this specific team member
  const memberKey = getMemberKey(teamMember);
  let sparklineData: SparklineData | null = null;

  if (sharedData) {
    let memberData;
    
    if (sharedData.memberData && sharedData.memberData[memberKey]) {
      // Use pre-processed data (faster)
      memberData = sharedData.memberData[memberKey];
    } else {
      // Fallback to processing snapshots (slower)
      memberData = sharedData.snapshots.map((snapshot: any) => ({
        value: snapshot[memberKey] || 0,
        date: snapshot.date,
        dataSource: snapshot.dataSource,
        error: snapshot.error
      }));
    }

    sparklineData = {
      data: memberData.map((d: any) => d.value),
      dates: memberData.map((d: any) => d.date),
      dataSource: memberData.map((d: any) => d.dataSource),
      errorWeeks: sharedData.errorWeeks,
      totalWeeks: sharedData.totalWeeks
    };
  }

  return {
    data: sparklineData,
    loading: sharedLoading,
    error: sharedError,
    refresh,
    isRefreshing
  };
}

