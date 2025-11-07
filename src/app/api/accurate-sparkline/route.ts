import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getWeeklyData, WeeklyDataResult } from '@/lib/weekly-data-source';

interface WeeklySnapshot {
  date: string;
  adam: number;
  jennie: number;
  jacqueline: number;
  robert: number;
  garima: number;
  lizzy: number;
  sanela: number;
  total: number;
  dataSource: 'csv' | 'snapshot' | 'live' | 'reconstruction' | 'skip';
  note?: string;
}

interface MemberDataPoint {
  value: number;
  date: string;
  dataSource: WeeklySnapshot['dataSource'];
  note?: string;
}

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

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDatabaseService();
    
    // Get capacity data for quick lookup
    const capacityData = await db.getCapacityData();
    
    // Load CSV cache for legacy data
    const csvDataCache = loadCSVDataCache();
    
    // Generate weekly snapshots from Feb 10, 2025 to current date
    const snapshots: WeeklySnapshot[] = [];
    const startDate = new Date('2025-02-10');
    const currentDate = new Date();
    
    // Generate all Mondays from start date to current date
    const mondays = generateMondays(startDate, currentDate);
    
    // Process each week using the shared data source strategy
    for (const monday of mondays) {
      const mondayStr = monday.toISOString().split('T')[0];
      
      try {
        const result = await getWeeklyData({
          monday,
          capacityData,
          csvDataCache,
          currentDate,
          useLiveDataForRecentWeeks: true,
          recentWeekThresholdDays: 14,
          historicalReconstructionThresholdDays: 30,
        });
        
        // Map the result to WeeklySnapshot format
        snapshots.push({
          date: mondayStr,
          adam: result.data.adam,
          jennie: result.data.jennie,
          jacqueline: result.data.jacqueline,
          robert: result.data.robert,
          garima: result.data.garima,
          lizzy: result.data.lizzy,
          sanela: result.data.sanela,
          total: result.data.total,
          dataSource: mapDataSourceType(result.source),
          note: result.metadata?.note,
        });
      } catch (error) {
        console.error(`Error getting data for week ${mondayStr}:`, error);
        // Add error snapshot
        snapshots.push({
          date: mondayStr,
          adam: 0,
          jennie: 0,
          jacqueline: 0,
          robert: 0,
          garima: 0,
          lizzy: 0,
          sanela: 0,
          total: 0,
          dataSource: 'skip',
          note: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    // Pre-calculate member data to avoid repeated processing on client
    const memberDataMap = new Map<string, MemberDataPoint[]>();
    
    // Initialize arrays for each member
    Object.values(TEAM_MEMBERS).forEach(memberKey => {
      memberDataMap.set(memberKey, []);
    });
    
    // Process snapshots once
    snapshots.forEach(snapshot => {
      Object.values(TEAM_MEMBERS).forEach(memberKey => {
        const value = (snapshot[memberKey as keyof WeeklySnapshot] as number) || 0;
        const memberData = memberDataMap.get(memberKey);
        if (memberData) {
          memberData.push({
            value: typeof value === 'number' ? value : 0,
            date: snapshot.date,
            dataSource: snapshot.dataSource,
            note: snapshot.note,
          });
        }
      });
    });
    
    return NextResponse.json({
      success: true,
      data: {
        snapshots,
        memberData: Object.fromEntries(memberDataMap), // Pre-processed data by member
        totalWeeks: snapshots.length,
        csvWeeks: snapshots.filter(s => s.dataSource === 'csv').length,
        snapshotWeeks: snapshots.filter(s => s.dataSource === 'snapshot').length,
        liveWeeks: snapshots.filter(s => s.dataSource === 'live').length,
        reconstructionWeeks: snapshots.filter(s => s.dataSource === 'reconstruction').length,
        skippedWeeks: snapshots.filter(s => s.dataSource === 'skip').length,
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' // Cache for 1 minute
      }
    });
    
  } catch (error) {
    console.error('Error fetching accurate sparkline data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// POST endpoint for manual refresh
export async function POST() {
  try {
    // Re-run the GET logic
    return GET();
    
  } catch (error) {
    console.error('Error refreshing sparkline data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * Map DataSourceType to the format expected by the API response
 */
function mapDataSourceType(source: WeeklyDataResult['source']): WeeklySnapshot['dataSource'] {
  switch (source) {
    case 'live':
      return 'live';
    case 'snapshot':
      return 'snapshot';
    case 'reconstruction':
      return 'reconstruction';
    case 'csv':
      return 'csv';
    case 'skip':
      return 'skip';
    default:
      return 'skip';
  }
}

/**
 * Generate all Mondays between start and end dates
 */
function generateMondays(startDate: Date, endDate: Date): Date[] {
  const mondays: Date[] = [];
  const current = new Date(startDate);
  
  // Find the first Monday on or after start date
  while (current.getDay() !== 1) {
    current.setDate(current.getDate() + 1);
  }
  
  while (current <= endDate) {
    mondays.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  
  return mondays;
}

/**
 * Cache CSV data to avoid reading file multiple times
 */
interface CSVDataEntry {
  adam: number;
  jennie: number;
  jacqueline: number;
  robert: number;
  garima: number;
  lizzy: number;
  sanela: number;
  total: number;
}

let csvDataCache: Map<string, CSVDataEntry> | null = null;

function loadCSVDataCache(): Map<string, CSVDataEntry> {
  if (csvDataCache) {
    return csvDataCache;
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    
    const csvPath = path.join(process.cwd(), 'PM Capacity Tracking.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    csvDataCache = new Map();
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const columns = line.split(',');
      if (columns.length >= 9 && columns[0]) {
        const dateStr = columns[0].trim();
        // Store by date string in CSV format (M/D/YYYY)
        csvDataCache.set(dateStr, {
          adam: parseInt(columns[1]) || 0,
          jennie: parseInt(columns[2]) || 0,
          jacqueline: parseInt(columns[3]) || 0,
          robert: parseInt(columns[4]) || 0,
          garima: parseInt(columns[5]) || 0,
          lizzy: parseInt(columns[6]) || 0,
          sanela: parseInt(columns[7]) || 0,
          total: parseInt(columns[8]) || 0
        });
      }
    }
    
    return csvDataCache;
  } catch (error) {
    console.error('Error reading CSV data:', error);
    return new Map();
  }
}
