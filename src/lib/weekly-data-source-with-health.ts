/**
 * Weekly Data Source with Health Breakdowns
 * 
 * Extension of weekly-data-source.ts for endpoints that need health breakdowns
 * (like the trends page). Uses the same data source strategy but also provides
 * health breakdowns through historical reconstruction.
 */

import { CapacityData } from '@/types/jira';
import { getDataProcessor } from './data-processor';

export interface WeeklyDataWithHealthResult {
  week: string; // Monday date as string
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
  dataSource: 'live' | 'snapshot' | 'reconstruction' | 'csv' | 'skip';
}

interface WeeklyDataWithHealthOptions {
  monday: Date;
  capacityData: CapacityData[];
  targetAssignees: string[];
  activeProjects?: any[]; // Pre-fetched active projects for performance
  currentDate?: Date;
}

/**
 * Get weekly data with health breakdowns for trends page
 * Uses the same data source strategy as sparkline, but always reconstructs health breakdowns
 */
export async function getWeeklyDataWithHealth(
  options: WeeklyDataWithHealthOptions
): Promise<WeeklyDataWithHealthResult> {
  const {
    monday,
    capacityData,
    targetAssignees,
    activeProjects,
    currentDate = new Date(),
  } = options;

  const dataProcessor = getDataProcessor();
  const weekDateStr = monday.toISOString().split('T')[0];

  // Calculate week characteristics (same logic as weekly-data-source.ts)
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
  const isRecentWeek = daysSince <= 14;

  // Determine data source (for metadata)
  let dataSource: WeeklyDataWithHealthResult['dataSource'] = 'reconstruction';
  
  // Check for snapshot
  const snapshot = findSnapshotForWeek(monday, mondaySunday, capacityData);
  if (snapshot && !isCurrentWeek && !isRecentWeek) {
    dataSource = 'snapshot';
  } else if (isCurrentWeek || isRecentWeek) {
    dataSource = 'live';
  }

  // Always reconstruct health breakdowns for trends (snapshots don't store health breakdowns)
  // This ensures accuracy and consistency
  const healthBreakdown = {
    onTrack: 0,
    atRisk: 0,
    offTrack: 0,
    onHold: 0,
    mystery: 0,
    complete: 0,
    unknown: 0,
  };

  // Fetch active projects if not provided
  let projectsToUse = activeProjects;
  if (!projectsToUse) {
    const { getAllIssuesForCycleAnalysis } = await import('@/lib/jira-api');
    const allJiraIssues = await getAllIssuesForCycleAnalysis();
    projectsToUse = allJiraIssues.filter(issue => {
      const status = issue.fields.status.name;
      const isArchived = issue.fields.customfield_10454;
      const archivedOn = issue.fields.customfield_10456;
      
      if (isArchived || archivedOn) {
        return false;
      }
      
      return status === '02 Generative Discovery' ||
             status === '04 Problem Discovery' ||
             status === '05 Solution Discovery' ||
             status === '06 Build' ||
             status === '07 Beta';
    });
  }

  // Reconstruct health breakdowns for each target assignee in parallel
  const breakdownPromises = targetAssignees.map(async (assignee) => {
    try {
      // Always use optimized version if we have pre-fetched projects
      if (projectsToUse) {
        return await dataProcessor.getActiveHealthBreakdownForTeamMemberAtDateOptimized(
          assignee,
          monday,
          projectsToUse
        );
      }
      // Fall back to regular method (fetches issues internally)
      return await dataProcessor.getActiveHealthBreakdownForTeamMemberAtDate(assignee, monday);
    } catch (error) {
      console.warn(`Error getting health breakdown for ${assignee} at ${weekDateStr}:`, error);
      return {
        onTrack: 0,
        atRisk: 0,
        offTrack: 0,
        onHold: 0,
        mystery: 0,
        complete: 0,
        unknown: 0,
      };
    }
  });

  const breakdowns = await Promise.all(breakdownPromises);

  // Sum all breakdowns
  for (const memberBreakdown of breakdowns) {
    healthBreakdown.onTrack += memberBreakdown.onTrack;
    healthBreakdown.atRisk += memberBreakdown.atRisk;
    healthBreakdown.offTrack += memberBreakdown.offTrack;
    healthBreakdown.onHold += memberBreakdown.onHold;
    healthBreakdown.mystery += memberBreakdown.mystery;
    healthBreakdown.complete += memberBreakdown.complete;
    healthBreakdown.unknown += memberBreakdown.unknown;
  }

  // Calculate total from health breakdown (ensures consistency)
  const totalProjects = Object.values(healthBreakdown).reduce((sum, count) => sum + count, 0);

  // Reconstruct status breakdowns for each target assignee in parallel
  const statusBreakdown = {
    generativeDiscovery: 0,
    problemDiscovery: 0,
    solutionDiscovery: 0,
    build: 0,
    beta: 0,
    live: 0,
    wonDo: 0,
    unknown: 0,
  };

  const statusBreakdownPromises = targetAssignees.map(async (assignee) => {
    try {
      // Always use optimized version if we have pre-fetched projects
      if (projectsToUse) {
        return await dataProcessor.getActiveStatusBreakdownForTeamMemberAtDateOptimized(
          assignee,
          monday,
          projectsToUse
        );
      }
      // Fall back to regular method (fetches issues internally)
      return await dataProcessor.getActiveStatusBreakdownForTeamMemberAtDate(assignee, monday);
    } catch (error) {
      console.warn(`Error getting status breakdown for ${assignee} at ${weekDateStr}:`, error);
      return {
        generativeDiscovery: 0,
        problemDiscovery: 0,
        solutionDiscovery: 0,
        build: 0,
        beta: 0,
        live: 0,
        wonDo: 0,
        unknown: 0,
      };
    }
  });

  const statusBreakdowns = await Promise.all(statusBreakdownPromises);

  // Sum all status breakdowns
  for (const memberStatusBreakdown of statusBreakdowns) {
    statusBreakdown.generativeDiscovery += memberStatusBreakdown.generativeDiscovery;
    statusBreakdown.problemDiscovery += memberStatusBreakdown.problemDiscovery;
    statusBreakdown.solutionDiscovery += memberStatusBreakdown.solutionDiscovery;
    statusBreakdown.build += memberStatusBreakdown.build;
    statusBreakdown.beta += memberStatusBreakdown.beta;
    statusBreakdown.live += memberStatusBreakdown.live;
    statusBreakdown.wonDo += memberStatusBreakdown.wonDo;
    statusBreakdown.unknown += memberStatusBreakdown.unknown;
  }

  return {
    week: monday.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    totalProjects,
    healthBreakdown,
    statusBreakdown,
    dataSource,
  };
}

/**
 * Find snapshot for a given week (tries both Sunday and Monday dates)
 * Same logic as in weekly-data-source.ts
 */
function findSnapshotForWeek(
  monday: Date,
  mondaySunday: Date,
  capacityData: Array<CapacityData & { date: Date | string }>
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
    } else if (typeof dateValue === 'string') {
      snapshotDateStr = dateValue.split('T')[0];
    } else {
      return false;
    }

    // Try matching against both Sunday and Monday dates
    return snapshotDateStr === sundayDateStr || snapshotDateStr === mondayDateStr;
  }) || null;
}

