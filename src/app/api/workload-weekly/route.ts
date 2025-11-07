import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

// Team member mapping
const TEAM_MEMBER_MAP = {
  adam: 'Adam Sigel',
  jennie: 'Jennie Goldenberg',
  jacqueline: 'Jacqueline Gallagher',
  robert: 'Robert J. Johnson',
  garima: 'Garima Giri',
  lizzy: 'Lizzy Magill',
  sanela: 'Sanela Smaka'
} as const;

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Get current date and determine start of current week (Sunday)
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    weekStart.setHours(0, 0, 0, 0);
    
    // Get ALL capacity data first
    const allCapacityData = await dbService.getCapacityData();
    console.log(`[workload-weekly] Found ${allCapacityData.length} total snapshots in capacity_data`);
    
    // Get the snapshot for this week
    let weekSnapshot = allCapacityData.find(d => {
      const snapshotDate = new Date(d.date);
      snapshotDate.setHours(0, 0, 0, 0);
      return snapshotDate.getTime() === weekStart.getTime();
    });
    
    // If no snapshot for this week, try to get the most recent one
    if (!weekSnapshot && allCapacityData.length > 0) {
      weekSnapshot = allCapacityData[allCapacityData.length - 1];
      console.log(`[workload-weekly] No snapshot for current week (${weekStart.toISOString().split('T')[0]}), using most recent: ${weekSnapshot.date.toISOString().split('T')[0]}`);
    }
    
    // If still no snapshot, return error with helpful message
    if (!weekSnapshot) {
      console.log(`[workload-weekly] No snapshots found in capacity_data table`);
      return NextResponse.json({
        success: false,
        error: 'No weekly snapshot found. Please create a snapshot first.',
        action: 'create_snapshot',
        currentWeekStart: weekStart.toISOString().split('T')[0],
        totalSnapshots: allCapacityData.length
      }, { status: 404 });
    }
    
    const dataProcessor = getDataProcessor();
    
    // Determine if we're using current week or historical week
    const isCurrentWeek = weekSnapshot.date.getTime() === weekStart.getTime();
    const snapshotDate = weekSnapshot.date;
    
    // IMPORTANT: Always use live data if snapshot is not for current week
    // Historical reconstruction is too slow and should only be used when explicitly viewing historical data
    // For the dashboard, we want current data even if snapshot is old
    const useLiveData = isCurrentWeek || true; // Always use live data for now
    
    // Get health breakdown for each team member
    // For current week: use live data (fast)
    // For historical weeks: use live data too (fast, but note snapshot date may be different)
    const teamMembers = Object.values(TEAM_MEMBER_MAP);
    const workloadData = await Promise.all(teamMembers.map(async (member) => {
      // Always use live method for performance - historical reconstruction is too slow
      const healthBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMember(member);
      
      // Calculate activeProjectCount as the sum of all health values
      // This ensures activeProjectCount always matches the health breakdown sum
      // This works for both current and historical weeks
      const activeProjectCount = healthBreakdown.onTrack + 
                                healthBreakdown.atRisk + 
                                healthBreakdown.offTrack + 
                                healthBreakdown.onHold + 
                                healthBreakdown.mystery + 
                                healthBreakdown.complete + 
                                healthBreakdown.unknown;
      
      // Note: We still store the snapshot date for reference, but use live counts
      const memberKey = Object.entries(TEAM_MEMBER_MAP).find(([_, name]) => name === member)?.[0] as keyof typeof TEAM_MEMBER_MAP | undefined;
      const snapshotCount = memberKey ? (weekSnapshot as any)[memberKey] || 0 : 0;
      
      return {
        teamMember: member,
        activeProjectCount,
        isOverloaded: activeProjectCount >= 6,
        healthBreakdown,
        // Include snapshot count for reference/debugging
        snapshotCount,
        projectDetails: {
          onTrack: [],
          atRisk: [],
          offTrack: [],
          onHold: [],
          mystery: [],
          complete: [],
          unknown: []
        },
        snapshotDate: weekSnapshot.date.toISOString().split('T')[0],
        dataSource: 'live_jira', // Always using live data for performance
        isHistorical: !isCurrentWeek,
        note: isCurrentWeek ? 'Using live data for current week' : 'Using live data (snapshot date is old, historical reconstruction too slow)'
      };
    }));
    
    return NextResponse.json({
      success: true,
      data: workloadData,
      metadata: {
        snapshotDate: weekSnapshot.date.toISOString().split('T')[0],
        currentWeekStart: weekStart.toISOString().split('T')[0],
        isCurrentWeek: weekSnapshot.date.getTime() === weekStart.getTime(),
        dataSource: 'weekly_snapshot',
        lastUpdated: weekSnapshot.date.toISOString(),
        notes: weekSnapshot.notes
      }
    });
    
  } catch (error) {
    console.error('Error fetching weekly workload data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch weekly workload data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

