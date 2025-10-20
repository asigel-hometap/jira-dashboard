import { NextRequest, NextResponse } from 'next/server';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET(request: NextRequest) {
  try {
    // Fetch live data directly from Jira API
    const jiraIssues = await getAllIssuesForCycleAnalysis();
    
    // Show all statuses and their counts
    const statusCounts: Record<string, number> = {};
    jiraIssues.forEach(issue => {
      const status = issue.fields.status.name;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    // Show all assignees and their counts
    const assigneeCounts: Record<string, number> = {};
    jiraIssues.forEach(issue => {
      const assignee = issue.fields.assignee?.displayName || 'Unassigned';
      assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
    });
    
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
    
    // Show active projects by assignee
    const activeAssigneeCounts: Record<string, number> = {};
    activeProjects.forEach(project => {
      const assignee = project.fields.assignee?.displayName || 'Unassigned';
      activeAssigneeCounts[assignee] = (activeAssigneeCounts[assignee] || 0) + 1;
    });
    
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
    
    // Get detailed breakdown for each team member
    const teamMemberDetails = teamMembers.map(teamMember => {
      const memberProjects = activeProjects.filter(project => {
        const assignee = project.fields.assignee?.displayName;
        return assignee === teamMember;
      });
      
      const projectDetails = memberProjects.map(project => ({
        key: project.key,
        summary: project.fields.summary,
        status: project.fields.status.name,
        health: project.fields.customfield_10238?.value || 'null',
        assignee: project.fields.assignee?.displayName || 'Unassigned',
        resolution: project.fields.resolution?.name || 'null',
        archived: project.fields.customfield_10454 || false,
        archivedOn: project.fields.customfield_10456 || 'null',
        labels: project.fields.labels || []
      }));
      
      return {
        teamMember,
        totalProjects: memberProjects.length,
        projects: projectDetails
      };
    });
    
    return NextResponse.json({
      success: true,
      data: {
        totalJiraIssues: jiraIssues.length,
        statusDistribution: statusCounts,
        allAssigneeDistribution: assigneeCounts,
        activeProjectsCount: activeProjects.length,
        activeAssigneeDistribution: activeAssigneeCounts,
        teamMemberDetails
      }
    });
    
  } catch (error) {
    console.error('Error in debug filtering:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to debug filtering',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
