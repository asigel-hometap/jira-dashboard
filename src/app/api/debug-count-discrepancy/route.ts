import { NextRequest, NextResponse } from 'next/server';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';
import { getDataProcessor } from '@/lib/data-processor';

/**
 * Diagnostic endpoint to identify discrepancies between activeProjectCount and sum of health breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const teamMember = request.nextUrl.searchParams.get('member') || 'Adam Sigel';
    
    // Fetch live data directly from Jira API
    const jiraIssues = await getAllIssuesForCycleAnalysis();
    console.log(`[debug] Fetched ${jiraIssues.length} issues from Jira`);
    
    // Filter for active projects using the same logic as workload-live
    const activeProjects = jiraIssues.filter(issue => {
      const status = issue.fields.status.name;
      const health = issue.fields.customfield_10238?.value;
      const isArchived = issue.fields.customfield_10454;
      const archivedOn = issue.fields.customfield_10456;
      
      // Exclude if archived
      if (isArchived || archivedOn) {
        return false;
      }
      
      // Apply the same filtering criteria as workload-live
      const isActiveStatus = status === '02 Generative Discovery' ||
                            status === '04 Problem Discovery' ||
                            status === '05 Solution Discovery' ||
                            status === '06 Build' ||
                            status === '07 Beta';
      
      const isActiveHealth = health && health !== 'Complete' && 
                            ['On Track', 'At Risk', 'Off Track', 'On Hold', 'Mystery'].includes(health);
      
      return isActiveStatus && isActiveHealth;
    });
    
    // Filter projects assigned to this team member
    const memberProjects = activeProjects.filter(project => {
      const assignee = project.fields.assignee?.displayName;
      return assignee === teamMember;
    });
    
    // Calculate health breakdown (same as workload-live)
    const healthBreakdown = {
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      onHold: 0,
      mystery: 0,
      complete: 0,
      unknown: 0
    };
    
    // Also track projects by status for debugging
    const projectsByStatus: Record<string, any[]> = {};
    const projectsByHealth: Record<string, any[]> = {};
    
    memberProjects.forEach(project => {
      const health = project.fields.customfield_10238?.value;
      const status = project.fields.status.name;
      const key = `${project.key}: ${project.fields.summary}`;
      
      // Track by status
      if (!projectsByStatus[status]) {
        projectsByStatus[status] = [];
      }
      projectsByStatus[status].push({ key, health: health || 'null', status });
      
      // Track by health
      const healthKey = health || 'null';
      if (!projectsByHealth[healthKey]) {
        projectsByHealth[healthKey] = [];
      }
      projectsByHealth[healthKey].push({ key, health: healthKey, status });
      
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
    
    // Calculate activeProjectCount (same logic as workload-live)
    const activeProjectCount = memberProjects.filter(project => {
      const health = project.fields.customfield_10238?.value;
      const status = project.fields.status.name;
      // Exclude complete projects only if they're in Live status (08+)
      return !(health === 'Complete' && status.startsWith('08'));
    }).length;
    
    // Sum of health breakdown
    const sumOfHealthBreakdown = Object.values(healthBreakdown).reduce((sum, count) => sum + count, 0);
    
    // Also get the data from getActiveHealthBreakdownForTeamMember for comparison
    const dataProcessor = getDataProcessor();
    const healthBreakdownFromProcessor = await dataProcessor.getActiveHealthBreakdownForTeamMember(teamMember);
    const sumFromProcessor = Object.values(healthBreakdownFromProcessor).reduce((sum, count) => sum + count, 0);
    
    return NextResponse.json({
      success: true,
      teamMember,
      counts: {
        totalMemberProjects: memberProjects.length,
        activeProjectCount,
        sumOfHealthBreakdown,
        discrepancy: sumOfHealthBreakdown - activeProjectCount,
        sumFromProcessor,
        discrepancyFromProcessor: sumFromProcessor - activeProjectCount
      },
      healthBreakdown,
      healthBreakdownFromProcessor,
      projectsByStatus,
      projectsByHealth,
      projectDetails: memberProjects.map(p => ({
        key: p.key,
        summary: p.fields.summary,
        status: p.fields.status.name,
        health: p.fields.customfield_10238?.value || 'null',
        assignee: p.fields.assignee?.displayName || 'unassigned'
      }))
    });
    
  } catch (error) {
    console.error('Error in count discrepancy diagnostic:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run diagnostic',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

