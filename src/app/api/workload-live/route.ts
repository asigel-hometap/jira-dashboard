import { NextRequest, NextResponse } from 'next/server';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET(request: NextRequest) {
  try {
    // Fetch live data directly from Jira API
    const jiraIssues = await getAllIssuesForCycleAnalysis();
    console.log(`Fetched ${jiraIssues.length} issues directly from Jira`);
    
    // Debug: Show status distribution
    const statusCounts: Record<string, number> = {};
    jiraIssues.forEach(issue => {
      const status = issue.fields.status.name;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('Status distribution:', statusCounts);
    
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
    
    console.log(`Filtered to ${activeProjects.length} active projects`);
    
    // Debug: Show assignee distribution for active projects
    const assigneeCounts: Record<string, number> = {};
    activeProjects.forEach(project => {
      const assignee = project.fields.assignee?.displayName || 'Unassigned';
      assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
    });
    console.log('Active projects by assignee:', assigneeCounts);
    
    // Team member mapping
    const teamMembers = [
      'Adam Sigel',
      'Jennie Goldenberg', 
      'Jacqueline Gallagher',
      'Robert J. Johnson',
      'Garima Giri',
      'Lizzy Magill',
      'Sanela Smaka'
    ];
    
    // Calculate workload for each team member using live Jira data
    const workloadData = teamMembers.map(teamMember => {
      // Filter projects assigned to this team member
      const memberProjects = activeProjects.filter(project => {
        const assignee = project.fields.assignee?.displayName;
        return assignee === teamMember;
      });
      
      console.log(`${teamMember}: ${memberProjects.length} projects from Jira`);
      
      // Debug: Log all projects for this team member
      memberProjects.forEach(project => {
        const health = project.fields.customfield_10238?.value;
        const status = project.fields.status.name;
        console.log(`  - ${project.key}: ${project.fields.summary} | Status: ${status} | Health: ${health || 'null'}`);
      });
      
      // Calculate health breakdown
      const healthBreakdown = {
        onTrack: 0,
        atRisk: 0,
        offTrack: 0,
        onHold: 0,
        mystery: 0,
        complete: 0,
        unknown: 0
      };
      
      memberProjects.forEach(project => {
        const health = project.fields.customfield_10238?.value;
        switch (health) {
          case 'On Track':
            healthBreakdown.onTrack++;
            break;
          case 'At Risk':
            healthBreakdown.atRisk++;
            break;
          case 'Off Track':
            healthBreakdown.offTrack++;
            break;
          case 'On Hold':
            healthBreakdown.onHold++;
            break;
          case 'Mystery':
            healthBreakdown.mystery++;
            break;
          case 'Complete':
            healthBreakdown.complete++;
            break;
          default:
            healthBreakdown.unknown++;
            break;
        }
      });
      
      // Calculate total active project count (excluding complete projects in Live status)
      const activeProjectCount = memberProjects.filter(project => {
        const health = project.fields.customfield_10238?.value;
        const status = project.fields.status.name;
        // Exclude complete projects only if they're in Live status (08+)
        return !(health === 'Complete' && status.startsWith('08'));
      }).length;
      
      return {
        teamMember,
        activeProjectCount,
        isOverloaded: activeProjectCount >= 6,
        healthBreakdown,
        dataSource: 'live-jira' // Indicate this is live data
      };
    });
    
    return NextResponse.json({ 
      success: true, 
      data: workloadData,
      metadata: {
        totalJiraIssues: jiraIssues.length,
        activeProjects: activeProjects.length,
        dataSource: 'live-jira',
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error fetching live workload data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch live workload data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
