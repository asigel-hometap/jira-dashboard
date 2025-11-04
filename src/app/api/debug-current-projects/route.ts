import { NextRequest, NextResponse } from 'next/server';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

/**
 * Diagnostic endpoint to show exactly which projects are being counted for a team member
 * This helps us compare against Jira to find discrepancies
 */
export async function GET(request: NextRequest) {
  try {
    const teamMember = request.nextUrl.searchParams.get('member') || 'Jacqueline Gallagher';
    
    // Fetch live data directly from Jira API
    const jiraIssues = await getAllIssuesForCycleAnalysis();
    console.log(`[debug] Fetched ${jiraIssues.length} issues from Jira`);
    
    // Filter for active projects - same logic as workload-live
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
    
    console.log(`[debug] Filtered to ${activeProjects.length} active projects (excluding archived)`);
    
    // Filter projects assigned to this team member
    const memberProjects = activeProjects.filter(project => {
      const assignee = project.fields.assignee?.displayName;
      return assignee === teamMember;
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
    
    // Detailed project list
    const projects = memberProjects.map(project => {
      const health = project.fields.customfield_10238?.value || null;
      const status = project.fields.status.name;
      const assignee = project.fields.assignee?.displayName || 'Unassigned';
      const isArchived = project.fields.customfield_10454;
      const archivedOn = project.fields.customfield_10456;
      
      // Count in health breakdown
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
      
      return {
        key: project.key,
        summary: project.fields.summary,
        status,
        health,
        assignee,
        isArchived,
        archivedOn
      };
    });
    
    // Also check for projects that might be excluded
    const excludedByArchived = jiraIssues.filter(issue => {
      const assignee = issue.fields.assignee?.displayName;
      const isArchived = issue.fields.customfield_10454;
      const archivedOn = issue.fields.customfield_10456;
      const status = issue.fields.status.name;
      const isActiveStatus = status === '02 Generative Discovery' ||
                            status === '04 Problem Discovery' ||
                            status === '05 Solution Discovery' ||
                            status === '06 Build' ||
                            status === '07 Beta';
      
      return assignee === teamMember && 
             isActiveStatus && 
             (isArchived || archivedOn);
    }).map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      health: issue.fields.customfield_10238?.value || null,
      assignee: issue.fields.assignee?.displayName,
      isArchived: issue.fields.customfield_10454,
      archivedOn: issue.fields.customfield_10456,
      excludedReason: 'archived'
    }));
    
    // Check for projects in active statuses but assigned to different team members or unassigned
    const projectsInActiveStatuses = jiraIssues.filter(issue => {
      const status = issue.fields.status.name;
      const isActiveStatus = status === '02 Generative Discovery' ||
                            status === '04 Problem Discovery' ||
                            status === '05 Solution Discovery' ||
                            status === '06 Build' ||
                            status === '07 Beta';
      return isActiveStatus;
    });
    
    const otherAssigneeCounts: Record<string, number> = {};
    projectsInActiveStatuses.forEach(issue => {
      const assignee = issue.fields.assignee?.displayName || 'Unassigned';
      otherAssigneeCounts[assignee] = (otherAssigneeCounts[assignee] || 0) + 1;
    });
    
    const total = Object.values(healthBreakdown).reduce((sum, count) => sum + count, 0);
    
    // Calculate total projects assigned to this member (including archived)
    const totalAssignedToMember = memberProjects.length + excludedByArchived.length;
    
    return NextResponse.json({
      success: true,
      teamMember,
      summary: {
        totalProjects: memberProjects.length,
        sumOfHealthBreakdown: total,
        matches: memberProjects.length === total,
        healthBreakdown
      },
      includedProjects: projects,
      excludedProjects: {
        byArchived: excludedByArchived,
        totalExcludedByArchived: excludedByArchived.length
      },
      diagnostic: {
        totalJiraIssues: jiraIssues.length,
        totalInActiveStatuses: projectsInActiveStatuses.length,
        activeProjectsAfterArchiveFilter: activeProjects.length,
        memberProjects: memberProjects.length,
        totalAssignedToMember: totalAssignedToMember, // Includes archived
        archivedProjects: excludedByArchived.length,
        note: "assigneeDistribution shows counts BEFORE archive filtering (includes archived projects)",
        assigneeDistribution: otherAssigneeCounts
      }
    });
    
  } catch (error) {
    console.error('Error in debug:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run debug',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

