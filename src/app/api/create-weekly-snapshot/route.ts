import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    console.log('Creating weekly snapshot with archived project filtering...');
    const startTime = Date.now();
    
    // Get current date and determine snapshot date (start of current week)
    const now = new Date();
    const snapshotDate = new Date(now);
    snapshotDate.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    snapshotDate.setHours(0, 0, 0, 0);
    
    console.log(`Creating snapshot for week starting: ${snapshotDate.toISOString().split('T')[0]}`);
    
    // Fetch live data directly from Jira API
    const jiraIssues = await getAllIssuesForCycleAnalysis();
    console.log(`Fetched ${jiraIssues.length} issues from Jira`);
    
    // Filter for active projects (discovery, build, beta statuses) and exclude archived projects
    const activeProjects = jiraIssues.filter(issue => {
      const status = issue.fields.status.name;
      const isArchived = issue.fields.customfield_10454; // "Idea archived" field
      const archivedOn = issue.fields.customfield_10456; // "Idea archived on" field
      
      // Exclude if archived
      if (isArchived || archivedOn) {
        return false;
      }
      
      // Include only discovery, build, beta statuses
      return status === '02 Generative Discovery' ||
             status === '04 Problem Discovery' ||
             status === '05 Solution Discovery' ||
             status === '06 Build' ||
             status === '07 Beta';
    });
    
    console.log(`Filtered to ${activeProjects.length} active projects (excluding archived)`);
    
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
    const teamMemberCounts: { [key: string]: { total: number; active: number } } = {};
    
    for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
      // Filter projects assigned to this team member
      const memberProjects = activeProjects.filter(project => {
        const assignee = project.fields.assignee?.displayName;
        return assignee === fullName;
      });
      
      // Calculate total project count (including complete projects)
      const totalProjectCount = memberProjects.length;
      
      // Calculate active project count (excluding complete projects in Live status)
      const activeProjectCount = memberProjects.filter(project => {
        const health = project.fields.customfield_10238?.value;
        const status = project.fields.status.name;
        return !(health === 'Complete' && status.startsWith('08'));
      }).length;
      
      teamMemberCounts[shortName] = {
        total: totalProjectCount,
        active: activeProjectCount
      };
      
      console.log(`${fullName}: ${totalProjectCount} total, ${activeProjectCount} active projects`);
    }
    
    // Create capacity data entry for this week
    const capacityData = {
      date: snapshotDate,
      adam: teamMemberCounts.adam.total,
      jennie: teamMemberCounts.jennie.total,
      jacqueline: teamMemberCounts.jacqueline.total,
      robert: teamMemberCounts.robert.total,
      garima: teamMemberCounts.garima.total,
      lizzy: teamMemberCounts.lizzy.total,
      sanela: teamMemberCounts.sanela.total,
      total: Object.values(teamMemberCounts).reduce((sum, counts) => sum + counts.total, 0),
      notes: 'Weekly snapshot with archived project filtering',
      dataSource: 'weekly_snapshot'
    };
    
    // Store the capacity data
    await dbService.insertCapacityData(capacityData);
    
            // Skip project snapshots for now due to foreign key constraints
            // TODO: Fix foreign key constraints or create a different approach for project snapshots
            const snapshotCount = 0;
    // for (const project of activeProjects) {
    //   const snapshot = {
    //     id: `${snapshotDate.toISOString().split('T')[0]}-${project.key}`,
    //     snapshotDate,
    //     issueKey: project.key,
    //     status: project.fields.status.name,
    //     health: project.fields.customfield_10238?.value || null,
    //     assignee: project.fields.assignee?.displayName || null,
    //     isActive: true // All projects in this snapshot are active
    //   };
    //   
    //   await dbService.insertProjectSnapshot(snapshot);
    //   snapshotCount++;
    // }
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: `Weekly snapshot created successfully`,
      data: {
        snapshotDate: snapshotDate.toISOString().split('T')[0],
        totalProjects: activeProjects.length,
        projectSnapshots: snapshotCount,
        teamMemberCounts,
        duration: `${duration}ms`
      }
    });
    
  } catch (error) {
    console.error('Error creating weekly snapshot:', error);
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
