import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';
import { STATUSES, HEALTH_VALUES } from '@/types/jira';

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
  dataSource: 'csv' | 'trends' | 'current' | 'error';
  error?: string;
}


// Active statuses for filtering
const ACTIVE_STATUSES = [
  STATUSES.GENERATIVE_DISCOVERY,
  STATUSES.PROBLEM_DISCOVERY,
  STATUSES.SOLUTION_DISCOVERY,
  STATUSES.BUILD,
  STATUSES.BETA
];

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
    
    // Generate weekly snapshots from Feb 10, 2025 to current date
    const snapshots: WeeklySnapshot[] = [];
    const startDate = new Date('2025-02-10');
    const currentDate = new Date();
    
    // Generate all Mondays from start date to current date
    const mondays = generateMondays(startDate, currentDate);
    
    for (const monday of mondays) {
      const mondayStr = monday.toISOString().split('T')[0];
      
      if (monday < new Date('2025-09-15')) {
        // Use CSV data for dates before September 15, 2025
        const csvData = await getCSVDataForDate(monday);
        if (csvData) {
          snapshots.push({
            date: mondayStr,
            adam: csvData.adam || 0,
            jennie: csvData.jennie || 0,
            jacqueline: csvData.jacqueline || 0,
            robert: csvData.robert || 0,
            garima: csvData.garima || 0,
            lizzy: csvData.lizzy || 0,
            sanela: csvData.sanela || 0,
            total: csvData.total || 0,
            dataSource: 'csv'
          });
        }
      } else {
        // For September 15+ dates, first check if we have a snapshot in capacity_data
        // This is much faster than historical reconstruction
        const snapshotForDate = capacityData.find(d => {
          const snapshotDate = new Date(d.date);
          snapshotDate.setHours(0, 0, 0, 0);
          const mondayDate = new Date(monday);
          mondayDate.setHours(0, 0, 0, 0);
          return snapshotDate.getTime() === mondayDate.getTime();
        });
        
        if (snapshotForDate) {
          // Use stored snapshot - fast!
          snapshots.push({
            date: mondayStr,
            adam: snapshotForDate.adam || 0,
            jennie: snapshotForDate.jennie || 0,
            jacqueline: snapshotForDate.jacqueline || 0,
            robert: snapshotForDate.robert || 0,
            garima: snapshotForDate.garima || 0,
            lizzy: snapshotForDate.lizzy || 0,
            sanela: snapshotForDate.sanela || 0,
            total: snapshotForDate.total || 0,
            dataSource: 'snapshot'
          });
        } else {
          // No snapshot - use historical reconstruction (slow, but only for missing weeks)
          // Only do this for recent weeks, skip if too old to avoid performance issues
          const daysSince = Math.floor((currentDate.getTime() - monday.getTime()) / (24 * 60 * 60 * 1000));
          
          if (daysSince <= 30) {
            // Only reconstruct for weeks within last 30 days
            try {
              const trendsData = await getTrendsDataForDate(monday);
              snapshots.push({
                date: mondayStr,
                adam: trendsData?.adam || 0,
                jennie: trendsData?.jennie || 0,
                jacqueline: trendsData?.jacqueline || 0,
                robert: trendsData?.robert || 0,
                garima: trendsData?.garima || 0,
                lizzy: trendsData?.lizzy || 0,
                sanela: trendsData?.sanela || 0,
                total: trendsData?.total || 0,
                dataSource: trendsData ? 'trends' : 'current'
              });
            } catch (error) {
              console.error(`Error getting trends data for ${mondayStr}:`, error);
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
                dataSource: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          } else {
            // Too old, skip historical reconstruction (too slow)
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
              dataSource: 'skipped',
              note: 'No snapshot found and week is too old for reconstruction'
            });
          }
        }
      }
    }
    
    // Pre-calculate member data to avoid repeated processing on client
    const memberDataMap = new Map<string, any[]>();
    
    // Initialize arrays for each member
    Object.values(TEAM_MEMBERS).forEach(memberKey => {
      memberDataMap.set(memberKey, []);
    });
    
    // Process snapshots once
    snapshots.forEach(snapshot => {
      Object.values(TEAM_MEMBERS).forEach(memberKey => {
        const value = (snapshot as any)[memberKey] || 0;
        memberDataMap.get(memberKey)?.push({
          value,
          date: snapshot.date,
          dataSource: snapshot.dataSource,
          error: (snapshot as any).error
        });
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
        trendsWeeks: snapshots.filter(s => s.dataSource === 'trends').length,
        currentWeeks: snapshots.filter(s => s.dataSource === 'current').length,
        errorWeeks: snapshots.filter(s => s.dataSource === 'error').length
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' // Cache for 5 minutes
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

// Cache CSV data to avoid reading file multiple times
let csvDataCache: Map<string, Partial<WeeklySnapshot>> | null = null;

function loadCSVDataCache(): Map<string, Partial<WeeklySnapshot>> {
  if (csvDataCache) {
    return csvDataCache;
  }
  
  try {
    const fs = require('fs');
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

async function getCSVDataForDate(date: Date): Promise<Partial<WeeklySnapshot> | null> {
  try {
    const cache = loadCSVDataCache();
    
    // Try multiple date formats
    const targetDateStr1 = date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
    
    const targetDateStr2 = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    
    return cache.get(targetDateStr1) || cache.get(targetDateStr2) || null;
  } catch (error) {
    console.error('Error getting CSV data:', error);
    return null;
  }
}

async function getCurrentProjectCounts(db: any): Promise<Partial<WeeklySnapshot>> {
  // Get current active issues from database
  const issues = await db.getActiveIssues();
  
  // Count active projects by assignee using the new filtering criteria
  const counts = {
    adam: 0,
    jennie: 0,
    jacqueline: 0,
    robert: 0,
    garima: 0,
    lizzy: 0,
    sanela: 0,
    total: 0
  };
  
  console.log(`Processing ${issues.length} issues for current project counts`);
  
  for (const issue of issues) {
    // Apply filtering criteria: only filter by status (no health filtering)
    // All health values should be included
    const isActive = ACTIVE_STATUSES.includes(issue.status);
    
    if (isActive && issue.assignee) {
      const memberKey = TEAM_MEMBERS[issue.assignee as keyof typeof TEAM_MEMBERS];
      if (memberKey) {
        counts[memberKey]++;
        counts.total++;
        console.log(`Found active project for ${issue.assignee}: ${issue.key} (${issue.status}, ${issue.health})`);
      }
    }
  }
  
  console.log('Current project counts:', counts);
  return counts;
}

async function getTrendsDataForDate(targetDate: Date): Promise<Partial<WeeklySnapshot> | null> {
  try {
    // Calculate counts directly using the data processor for the target date
    // This avoids API call issues and uses the same logic as workload-weekly
    const { getDataProcessor } = await import('@/lib/data-processor');
    const dataProcessor = getDataProcessor();
    
    const teamMemberMap = {
      'Adam Sigel': 'adam',
      'Jennie Goldenberg': 'jennie',
      'Jacqueline Gallagher': 'jacqueline',
      'Robert J. Johnson': 'robert',
      'Garima Giri': 'garima',
      'Lizzy Magill': 'lizzy',
      'Sanela Smaka': 'sanela'
    };
    
    const counts: Partial<WeeklySnapshot> = {
      adam: 0,
      jennie: 0,
      jacqueline: 0,
      robert: 0,
      garima: 0,
      lizzy: 0,
      sanela: 0,
      total: 0
    };
    
    // Calculate for each team member
    for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
      try {
        const healthBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMemberAtDate(fullName, targetDate);
        
        // Calculate total as sum of all health values
        const total = healthBreakdown.onTrack + healthBreakdown.atRisk + 
                     healthBreakdown.offTrack + healthBreakdown.onHold + 
                     healthBreakdown.mystery + healthBreakdown.complete + 
                     healthBreakdown.unknown;
        
        (counts as any)[shortName] = total;
        counts.total = (counts.total || 0) + total;
      } catch (error) {
        console.warn(`Error calculating count for ${fullName} at ${targetDate.toISOString().split('T')[0]}:`, error);
      }
    }
    
    console.log(`Calculated trends data for ${targetDate.toISOString().split('T')[0]}:`, counts);
    return counts;
  } catch (error) {
    console.error('Error calculating trends data:', error);
    return null;
  }
}

