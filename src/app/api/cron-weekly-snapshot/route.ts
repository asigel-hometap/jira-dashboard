import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

/**
 * Weekly snapshot cron job endpoint
 * 
 * This endpoint can be called by:
 * - Vercel Cron Jobs (via vercel.json)
 * - GitHub Actions
 * - External cron services (cron-job.org, etc.)
 * 
 * It automatically creates a weekly snapshot for the start of the current week.
 * It includes authentication check to prevent unauthorized access.
 */

export async function GET(request: NextRequest) {
  try {
    // Check for authorization header (for security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // If CRON_SECRET is set, require it for authentication
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Unauthorized',
            message: 'Missing or invalid authorization token'
          },
          { status: 401 }
        );
      }
    }
    
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    console.log('[CRON] Creating weekly snapshot...');
    const startTime = Date.now();
    
    // Get current date and determine snapshot date (start of current week)
    const now = new Date();
    const snapshotDate = new Date(now);
    snapshotDate.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    snapshotDate.setHours(0, 0, 0, 0);
    
    console.log(`[CRON] Creating snapshot for week starting: ${snapshotDate.toISOString().split('T')[0]}`);
    
    // Check if snapshot already exists for this week
    const existingData = await dbService.getCapacityData(snapshotDate, snapshotDate);
    if (existingData.length > 0) {
      console.log(`[CRON] Snapshot already exists for ${snapshotDate.toISOString().split('T')[0]}, updating...`);
    }
    
    // Fetch live data directly from Jira API
    const jiraIssues = await getAllIssuesForCycleAnalysis();
    console.log(`[CRON] Fetched ${jiraIssues.length} issues from Jira`);
    
    // Filter for active projects - only filter by status and archived, NOT by health
    // All health values (Complete, unknown, etc.) should be included
    const activeProjects = jiraIssues.filter(issue => {
      const status = issue.fields.status.name;
      const isArchived = issue.fields.customfield_10454; // "Idea archived" field
      const archivedOn = issue.fields.customfield_10456; // "Idea archived on" field
      
      // Exclude if archived
      if (isArchived || archivedOn) {
        return false;
      }
      
      // Include only active statuses (no health-based filtering)
      const isActiveStatus = status === '02 Generative Discovery' ||
                            status === '04 Problem Discovery' ||
                            status === '05 Solution Discovery' ||
                            status === '06 Build' ||
                            status === '07 Beta';
      
      return isActiveStatus;
    });
    
    console.log(`[CRON] Filtered to ${activeProjects.length} active projects (excluding archived)`);
    
    // Team member mapping
    const teamMemberMap = {
      'Adam Sigel': 'adam',
      'Jennie Goldenberg': 'jennie', 
      'Jacqueline Gallagher': 'jacqueline',
      'Robert J. Johnson': 'robert',
      'Garima Giri': 'garima',
      'Lizzy Magill': 'lizzy',
      'Sanela Smaka': 'sanela'
    };
    
    // Calculate workload for each team member
    const teamMemberCounts: { [key: string]: number } = {};
    
    for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
      // Filter projects assigned to this team member
      const memberProjects = activeProjects.filter(project => {
        const assignee = project.fields.assignee?.displayName;
        return assignee === fullName;
      });
      
      // Calculate active project count (already filtered above)
      const activeProjectCount = memberProjects.length;
      teamMemberCounts[shortName] = activeProjectCount;
      
      console.log(`[CRON] ${fullName}: ${activeProjectCount} active projects`);
    }
    
    // Create capacity data entry for this week
    const capacityData = {
      date: snapshotDate,
      adam: teamMemberCounts.adam || 0,
      jennie: teamMemberCounts.jennie || 0,
      jacqueline: teamMemberCounts.jacqueline || 0,
      robert: teamMemberCounts.robert || 0,
      garima: teamMemberCounts.garima || 0,
      lizzy: teamMemberCounts.lizzy || 0,
      sanela: teamMemberCounts.sanela || 0,
      total: Object.values(teamMemberCounts).reduce((sum, count) => sum + count, 0),
      notes: `[CRON] Weekly snapshot (status in active statuses, excluding archived, all health values included) - Created ${new Date().toISOString()}`
    };
    
    // Store the capacity data (will update if exists due to ON CONFLICT)
    await dbService.insertCapacityData(capacityData);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: `Weekly snapshot created successfully via cron`,
      data: {
        snapshotDate: snapshotDate.toISOString().split('T')[0],
        totalProjects: activeProjects.length,
        teamMemberCounts,
        duration: `${duration}ms`,
        triggeredBy: 'cron'
      }
    });
    
  } catch (error) {
    console.error('[CRON] Error creating weekly snapshot:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create weekly snapshot',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support POST for compatibility
export async function POST(request: NextRequest) {
  return GET(request);
}

