/**
 * Weekly Data Source Strategy
 * 
 * Centralized logic for determining which data source to use for a given week.
 * Used by both sparkline and trends pages to ensure consistency.
 * 
 * Data Source Priority:
 * 1. Live Data (for current week and recent weeks < 14 days) - ensures consistency with left side
 * 2. Snapshot with Individual Counts (for historical weeks) - fast and accurate
 * 3. Historical Reconstruction (if snapshot has only total) - slow but accurate
 * 4. CSV Data (for dates before Sept 15, 2025) - legacy data
 * 5. Skip (if too old and no data available)
 */

import { CapacityData } from '@/types/jira';
import { getDataProcessor } from './data-processor';

export type DataSourceType = 'live' | 'snapshot' | 'reconstruction' | 'csv' | 'skip';

export interface WeeklyDataResult {
  source: DataSourceType;
  data: {
    adam: number;
    jennie: number;
    jacqueline: number;
    robert: number;
    garima: number;
    lizzy: number;
    sanela: number;
    total: number;
  };
  healthBreakdown?: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    onHold: number;
    mystery: number;
    complete: number;
    unknown: number;
  };
  // Per-member health breakdowns (for trends page)
  memberHealthBreakdowns?: Record<string, {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    onHold: number;
    mystery: number;
    complete: number;
    unknown: number;
  }>;
  // Aggregated health breakdown (sum across all members)
  aggregatedHealthBreakdown?: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    onHold: number;
    mystery: number;
    complete: number;
    unknown: number;
  };
  metadata?: {
    note?: string;
    snapshotDate?: string;
  };
}

interface WeeklyDataSourceOptions {
  monday: Date;
  capacityData: CapacityData[];
  csvDataCache?: Map<string, any>;
  currentDate?: Date;
  useLiveDataForRecentWeeks?: boolean; // Default: true
  recentWeekThresholdDays?: number; // Default: 14
  historicalReconstructionThresholdDays?: number; // Default: 30
  includeHealthBreakdowns?: boolean; // Default: false - set to true for trends page
  targetAssignees?: string[]; // Optional: filter to specific assignees (for trends page)
}

/**
 * Get data for a specific week using the appropriate data source
 */
export async function getWeeklyData(
  options: WeeklyDataSourceOptions
): Promise<WeeklyDataResult> {
  const {
    monday,
    capacityData,
    csvDataCache,
    currentDate = new Date(),
    useLiveDataForRecentWeeks = true,
    recentWeekThresholdDays = 14,
    historicalReconstructionThresholdDays = 30,
    includeHealthBreakdowns = false,
    targetAssignees,
  } = options;

  const mondayStr = monday.toISOString().split('T')[0];
  
  // Calculate week characteristics
  const currentWeekStart = new Date(currentDate);
  currentWeekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Sunday of current week
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setUTCHours(0, 0, 0, 0);
  
  const mondaySunday = new Date(monday);
  mondaySunday.setDate(monday.getDate() - 1); // Sunday before Monday
  mondaySunday.setUTCHours(0, 0, 0, 0);
  
  const mondaySundayForComparison = new Date(mondaySunday);
  mondaySundayForComparison.setUTCHours(0, 0, 0, 0);
  const isCurrentWeek = mondaySundayForComparison.getTime() === currentWeekStart.getTime();
  
  const daysSince = Math.floor((currentDate.getTime() - monday.getTime()) / (24 * 60 * 60 * 1000));
  const isRecentWeek = daysSince <= recentWeekThresholdDays;
  const isBeforeSept15 = monday < new Date('2025-09-15');

  // Strategy 1: CSV Data (for dates before Sept 15, 2025)
  if (isBeforeSept15 && csvDataCache) {
    const csvData = getCSVDataForDate(monday, csvDataCache);
    if (csvData) {
      return {
        source: 'csv',
        data: {
          adam: csvData.adam || 0,
          jennie: csvData.jennie || 0,
          jacqueline: csvData.jacqueline || 0,
          robert: csvData.robert || 0,
          garima: csvData.garima || 0,
          lizzy: csvData.lizzy || 0,
          sanela: csvData.sanela || 0,
          total: csvData.total || 0,
        },
      };
    }
  }

  // Strategy 2: Live Data (for current week or recent weeks)
  if (isCurrentWeek || (isRecentWeek && useLiveDataForRecentWeeks)) {
    try {
      const liveData = await getLiveDataForWeek(monday);
      return {
        source: 'live',
        data: liveData,
        metadata: {
          note: isCurrentWeek 
            ? 'Using live data for current week (ensuring consistency with left side)'
            : `Using live data for recent week (within ${recentWeekThresholdDays} days)`,
        },
      };
    } catch (error) {
      console.error(`Error getting live data for ${mondayStr}:`, error);
      // Fall through to try snapshot or other sources
    }
  }

  // Strategy 3: Find snapshot for this week
  const snapshot = findSnapshotForWeek(monday, mondaySunday, capacityData);

  if (snapshot) {
    const hasIndividualCounts = snapshot.adam != null || 
                               snapshot.jennie != null || 
                               snapshot.jacqueline != null;

    if (hasIndividualCounts) {
      // Use snapshot with individual counts
      return {
        source: 'snapshot',
        data: {
          adam: snapshot.adam || 0,
          jennie: snapshot.jennie || 0,
          jacqueline: snapshot.jacqueline || 0,
          robert: snapshot.robert || 0,
          garima: snapshot.garima || 0,
          lizzy: snapshot.lizzy || 0,
          sanela: snapshot.sanela || 0,
          total: snapshot.total || 0,
        },
        metadata: {
          snapshotDate: snapshot.date instanceof Date 
            ? snapshot.date.toISOString().split('T')[0]
            : typeof snapshot.date === 'string' 
              ? (snapshot.date as string).split('T')[0]
              : undefined,
        },
      };
    } else if (snapshot.total != null) {
      // Snapshot has total but no individual counts - try reconstruction
      if (daysSince <= historicalReconstructionThresholdDays) {
        try {
          const reconstructed = await getHistoricalReconstruction(monday);
          if (reconstructed) {
            return {
              source: 'reconstruction',
              data: reconstructed,
              metadata: {
                note: 'Reconstructed from changelog data (snapshot had only total)',
                snapshotDate: snapshot.date instanceof Date 
                  ? snapshot.date.toISOString().split('T')[0]
                  : typeof snapshot.date === 'string' 
                    ? (snapshot.date as string).split('T')[0]
                    : undefined,
              },
            };
          }
        } catch (error) {
          console.error(`Error reconstructing data for ${mondayStr}:`, error);
        }
      }
      
      // Reconstruction failed or too old - return snapshot total only
      return {
        source: 'snapshot',
        data: {
          adam: 0,
          jennie: 0,
          jacqueline: 0,
          robert: 0,
          garima: 0,
          lizzy: 0,
          sanela: 0,
          total: snapshot.total || 0,
        },
        metadata: {
          note: 'Snapshot has only total, no individual counts',
          snapshotDate: snapshot.date instanceof Date 
            ? snapshot.date.toISOString().split('T')[0]
            : typeof snapshot.date === 'string' 
              ? (snapshot.date as string).split('T')[0]
              : undefined,
        },
      };
    }
  }

  // Strategy 4: Historical Reconstruction (if no snapshot and recent enough)
  if (!snapshot && daysSince <= historicalReconstructionThresholdDays) {
    try {
      const reconstructed = await getHistoricalReconstruction(monday);
      if (reconstructed) {
        return {
          source: 'reconstruction',
          data: reconstructed,
          metadata: {
            note: `Reconstructed from changelog data (no snapshot found, within ${historicalReconstructionThresholdDays} days)`,
          },
        };
      }
    } catch (error) {
      console.error(`Error reconstructing data for ${mondayStr}:`, error);
    }
  }

  // Strategy 5: Skip (too old, no data available)
  return {
    source: 'skip',
    data: {
      adam: 0,
      jennie: 0,
      jacqueline: 0,
      robert: 0,
      garima: 0,
      lizzy: 0,
      sanela: 0,
      total: 0,
    },
    metadata: {
      note: `No data available (too old for reconstruction: ${daysSince} days)`,
    },
  };
}

/**
 * Find snapshot for a given week (tries both Sunday and Monday dates)
 */
function findSnapshotForWeek(
  monday: Date,
  mondaySunday: Date,
  capacityData: CapacityData[]
): CapacityData | null {
  const sundayDateStr = mondaySunday.toISOString().split('T')[0];
  const mondayDateStr = monday.toISOString().split('T')[0];

  return capacityData.find(d => {
    let dateValue: string | Date;
    if (d.date instanceof Date) {
      dateValue = d.date;
    } else if (typeof d.date === 'string') {
      dateValue = d.date;
    } else {
      return false;
    }

    let snapshotDateStr: string;
    if (dateValue instanceof Date) {
      const normalizedDate = new Date(dateValue);
      normalizedDate.setUTCHours(0, 0, 0, 0);
      snapshotDateStr = normalizedDate.toISOString().split('T')[0];
    } else {
      // TypeScript type narrowing issue - dateValue is string here
      snapshotDateStr = (dateValue as string).split('T')[0];
    }

    // Try matching against both Sunday and Monday dates
    return snapshotDateStr === sundayDateStr || snapshotDateStr === mondayDateStr;
  }) || null;
}

/**
 * Get live data for a week (current state of projects)
 */
async function getLiveDataForWeek(monday: Date): Promise<WeeklyDataResult['data']> {
  const dataProcessor = getDataProcessor();
  const teamMemberMap = {
    'Adam Sigel': 'adam',
    'Jennie Goldenberg': 'jennie',
    'Jacqueline Gallagher': 'jacqueline',
    'Robert J. Johnson': 'robert',
    'Garima Giri': 'garima',
    'Lizzy Magill': 'lizzy',
    'Sanela Smaka': 'sanela',
  };

  const counts: WeeklyDataResult['data'] = {
    adam: 0,
    jennie: 0,
    jacqueline: 0,
    robert: 0,
    garima: 0,
    lizzy: 0,
    sanela: 0,
    total: 0,
  };

  for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
    try {
      const healthBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMember(fullName);
      const total = healthBreakdown.onTrack + healthBreakdown.atRisk +
                   healthBreakdown.offTrack + healthBreakdown.onHold +
                   healthBreakdown.mystery + healthBreakdown.complete +
                   healthBreakdown.unknown;
      
      counts[shortName as keyof WeeklyDataResult['data']] = total;
      counts.total = counts.total + total;
    } catch (error) {
      console.warn(`Error calculating count for ${fullName}:`, error);
    }
  }

  return counts;
}

/**
 * Get historical reconstruction for a specific date
 */
async function getHistoricalReconstruction(targetDate: Date): Promise<WeeklyDataResult['data'] | null> {
  const dataProcessor = getDataProcessor();
  const teamMemberMap = {
    'Adam Sigel': 'adam',
    'Jennie Goldenberg': 'jennie',
    'Jacqueline Gallagher': 'jacqueline',
    'Robert J. Johnson': 'robert',
    'Garima Giri': 'garima',
    'Lizzy Magill': 'lizzy',
    'Sanela Smaka': 'sanela',
  };

  const counts: WeeklyDataResult['data'] = {
    adam: 0,
    jennie: 0,
    jacqueline: 0,
    robert: 0,
    garima: 0,
    lizzy: 0,
    sanela: 0,
    total: 0,
  };

  for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
    try {
      const healthBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMemberAtDate(
        fullName,
        targetDate
      );
      const total = healthBreakdown.onTrack + healthBreakdown.atRisk +
                   healthBreakdown.offTrack + healthBreakdown.onHold +
                   healthBreakdown.mystery + healthBreakdown.complete +
                   healthBreakdown.unknown;
      
      counts[shortName as keyof WeeklyDataResult['data']] = total;
      counts.total = counts.total + total;
    } catch (error) {
      console.warn(`Error reconstructing count for ${fullName} at ${targetDate.toISOString()}:`, error);
      return null; // If any member fails, return null
    }
  }

  return counts;
}

/**
 * Get CSV data for a date (legacy data source)
 */
function getCSVDataForDate(monday: Date, csvDataCache: Map<string, { adam?: number; jennie?: number; jacqueline?: number; robert?: number; garima?: number; lizzy?: number; sanela?: number; total?: number }>): { adam: number; jennie: number; jacqueline: number; robert: number; garima: number; lizzy: number; sanela: number; total: number } | null {
  // Try multiple date formats
  const formats = [
    monday.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }), // M/D/YYYY
    monday.toISOString().split('T')[0], // YYYY-MM-DD
  ];

  for (const format of formats) {
    const data = csvDataCache.get(format);
    if (data) {
      return {
        adam: data.adam || 0,
        jennie: data.jennie || 0,
        jacqueline: data.jacqueline || 0,
        robert: data.robert || 0,
        garima: data.garima || 0,
        lizzy: data.lizzy || 0,
        sanela: data.sanela || 0,
        total: data.total || 0,
      };
    }
  }

  return null;
}

