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
    
    // Filter for active projects using the same logic as accurate-sparkline
    const activeProjects = jiraIssues.filter(issue => {
      const status = issue.fields.status.name;
      const health = issue.fields.customfield_10238?.value;
      const isArchived = issue.fields.customfield_10454; // "Idea archived" field
      const archivedOn = issue.fields.customfield_10456; // "Idea archived on" field
      
      // Exclude if archived
      if (isArchived || archivedOn) {
        return false;
      }
      
      // Apply the same filtering criteria as accurate-sparkline: health !== 'complete' AND status in active statuses
      const isActiveStatus = status === '02 Generative Discovery' ||
                            status === '04 Problem Discovery' ||
                            status === '05 Solution Discovery' ||
                            status === '06 Build' ||
                            status === '07 Beta';
      
      // Only include projects with specific health values (exclude null/undefined and 'Complete')
      const isActiveHealth = health && health !== 'Complete' && 
                            ['On Track', 'At Risk', 'Off Track', 'On Hold', 'Mystery'].includes(health);
      
      return isActiveStatus && isActiveHealth;
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
      
      // Calculate health breakdown and collect project details
      const healthBreakdown = {
        onTrack: 0,
        atRisk: 0,
        offTrack: 0,
        onHold: 0,
        mystery: 0,
        complete: 0,
        unknown: 0
      };
      
      const projectDetails = {
        onTrack: [] as any[],
        atRisk: [] as any[],
        offTrack: [] as any[],
        onHold: [] as any[],
        mystery: [] as any[],
        complete: [] as any[],
        unknown: [] as any[]
      };
      
      memberProjects.forEach(project => {
        const health = project.fields.customfield_10238?.value;
        const projectDetail = {
          key: project.key,
          summary: project.fields.summary,
          status: project.fields.status.name,
          health: health
        };
        
        switch (health) {
          case 'On Track':
            healthBreakdown.onTrack++;
            projectDetails.onTrack.push(projectDetail);
            break;
          case 'At Risk':
            healthBreakdown.atRisk++;
            projectDetails.atRisk.push(projectDetail);
            break;
          case 'Off Track':
            healthBreakdown.offTrack++;
            projectDetails.offTrack.push(projectDetail);
            break;
          case 'On Hold':
            healthBreakdown.onHold++;
            projectDetails.onHold.push(projectDetail);
            break;
          case 'Mystery':
            healthBreakdown.mystery++;
            projectDetails.mystery.push(projectDetail);
            break;
          case 'Complete':
            healthBreakdown.complete++;
            projectDetails.complete.push(projectDetail);
            break;
          default:
            healthBreakdown.unknown++;
            projectDetails.unknown.push(projectDetail);
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
        projectDetails,
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
