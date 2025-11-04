import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

/**
 * Comprehensive verification endpoint to test all three scenarios:
 * 1. Current week assessment
 * 2. Snapshot creation and storage
 * 3. Historical week assessment
 */
export async function GET(request: NextRequest) {
  try {
    const teamMember = request.nextUrl.searchParams.get('member') || 'Jacqueline Gallagher';
    const historicalDateStr = request.nextUrl.searchParams.get('historicalDate') || '2025-10-27';
    const historicalDate = new Date(historicalDateStr);
    
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    // ============================================
    // SCENARIO 1: Current Week Assessment
    // ============================================
    console.log('=== SCENARIO 1: Current Week Assessment ===');
    
    const jiraIssues = await getAllIssuesForCycleAnalysis();
    
    // Filter using same logic as workload-live
    const activeProjects = jiraIssues.filter(issue => {
      const status = issue.fields.status.name;
      const isArchived = issue.fields.customfield_10454;
      const archivedOn = issue.fields.customfield_10456;
      
      if (isArchived || archivedOn) {
        return false;
      }
      
      const isActiveStatus = status === '02 Generative Discovery' ||
                            status === '04 Problem Discovery' ||
                            status === '05 Solution Discovery' ||
                            status === '06 Build' ||
                            status === '07 Beta';
      
      return isActiveStatus;
    });
    
    const currentMemberProjects = activeProjects.filter(project => {
      const assignee = project.fields.assignee?.displayName;
      return assignee === teamMember;
    });
    
    const currentHealthBreakdown = {
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      onHold: 0,
      mystery: 0,
      complete: 0,
      unknown: 0
    };
    
    const currentProjects = currentMemberProjects.map(project => {
      const health = project.fields.customfield_10238?.value || null;
      
      switch (health) {
        case 'On Track': currentHealthBreakdown.onTrack++; break;
        case 'At Risk': currentHealthBreakdown.atRisk++; break;
        case 'Off Track': currentHealthBreakdown.offTrack++; break;
        case 'On Hold': currentHealthBreakdown.onHold++; break;
        case 'Mystery': currentHealthBreakdown.mystery++; break;
        case 'Complete': currentHealthBreakdown.complete++; break;
        default: currentHealthBreakdown.unknown++; break;
      }
      
      return {
        key: project.key,
        summary: project.fields.summary,
        status: project.fields.status.name,
        health
      };
    });
    
    const currentCount = currentMemberProjects.length;
    const currentSum = Object.values(currentHealthBreakdown).reduce((sum, count) => sum + count, 0);
    
    // Also get using the data processor method
    const currentFromProcessor = await dataProcessor.getActiveHealthBreakdownForTeamMember(teamMember);
    const currentFromProcessorSum = Object.values(currentFromProcessor).reduce((sum, count) => sum + count, 0);
    
    // ============================================
    // SCENARIO 2: Snapshot Creation Logic
    // ============================================
    console.log('=== SCENARIO 2: Snapshot Creation Logic ===');
    
    // Get current date and determine start of current week (Sunday)
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    // Check if snapshot exists for current week
    const allCapacityData = await dbService.getCapacityData();
    const currentWeekSnapshot = allCapacityData.find(d => {
      const snapshotDate = new Date(d.date);
      snapshotDate.setHours(0, 0, 0, 0);
      return snapshotDate.getTime() === weekStart.getTime();
    });
    
    // Simulate snapshot creation (same logic as create-weekly-snapshot)
    const snapshotCounts: Record<string, number> = {};
    const teamMemberMap = {
      'Adam Sigel': 'adam',
      'Jennie Goldenberg': 'jennie',
      'Jacqueline Gallagher': 'jacqueline',
      'Robert J. Johnson': 'robert',
      'Garima Giri': 'garima',
      'Lizzy Magill': 'lizzy',
      'Sanela Smaka': 'sanela'
    };
    
    for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
      const memberProjects = activeProjects.filter(project => {
        const assignee = project.fields.assignee?.displayName;
        return assignee === fullName;
      });
      snapshotCounts[shortName] = memberProjects.length;
    }
    
    const snapshotCountForMember = teamMemberMap[teamMember as keyof typeof teamMemberMap];
    const snapshotCount = snapshotCountForMember ? snapshotCounts[snapshotCountForMember] : 0;
    
    // ============================================
    // SCENARIO 3: Historical Week Assessment
    // ============================================
    console.log('=== SCENARIO 3: Historical Week Assessment ===');
    
    const historicalBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMemberAtDate(teamMember, historicalDate);
    const historicalSum = Object.values(historicalBreakdown).reduce((sum, count) => sum + count, 0);
    
    // Get detailed historical projects for comparison
    const historicalMemberIssues = activeProjects.filter(issue => {
      const assignee = issue.fields.assignee?.displayName;
      return assignee === teamMember;
    });
    
    const historicalProjects = [];
    for (const issue of historicalMemberIssues) {
      try {
        const wasAssigned = await dataProcessor.wasIssueAssignedToMemberAtDate(issue.key, teamMember, historicalDate);
        if (!wasAssigned) continue;
        
        const projectState = await dataProcessor.getProjectStateAtDate(issue, historicalDate);
        if (projectState) {
          const isActive = projectState.status === '02 Generative Discovery' ||
                          projectState.status === '04 Problem Discovery' ||
                          projectState.status === '05 Solution Discovery' ||
                          projectState.status === '06 Build' ||
                          projectState.status === '07 Beta';
          
          if (isActive) {
            historicalProjects.push({
              key: issue.key,
              summary: issue.fields.summary,
              statusAtDate: projectState.status,
              healthAtDate: projectState.health,
              currentStatus: issue.fields.status.name,
              currentHealth: issue.fields.customfield_10238?.value || null
            });
          }
        }
      } catch (error) {
        console.warn(`Error processing ${issue.key} for historical date:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      teamMember,
      scenarios: {
        scenario1_currentWeek: {
          description: 'Current week assessment using live Jira data',
          method: 'Direct filtering of current Jira issues',
          count: currentCount,
          sumOfHealthBreakdown: currentSum,
          matches: currentCount === currentSum,
          healthBreakdown: currentHealthBreakdown,
          projects: currentProjects,
          fromProcessor: {
            healthBreakdown: currentFromProcessor,
            sum: currentFromProcessorSum,
            matches: currentCount === currentFromProcessorSum
          }
        },
        scenario2_snapshot: {
          description: 'Snapshot creation logic (what would be stored)',
          method: 'Same filtering as scenario 1, stored in capacity_data',
          weekStart: weekStart.toISOString().split('T')[0],
          snapshotExists: !!currentWeekSnapshot,
          snapshotDate: currentWeekSnapshot?.date.toISOString().split('T')[0] || null,
          countForSnapshot: snapshotCount,
          matchesCurrent: snapshotCount === currentCount,
          allSnapshotCounts: snapshotCounts
        },
        scenario3_historical: {
          description: `Historical week assessment for ${historicalDateStr}`,
          method: 'Reconstruct project state using changelog data',
          targetDate: historicalDateStr,
          count: historicalSum,
          healthBreakdown: historicalBreakdown,
          projects: historicalProjects,
          note: 'Historical assessment uses changelog to reconstruct status/health at target date'
        }
      },
      comparison: {
        currentVsSnapshot: {
          currentCount,
          snapshotCount,
          difference: currentCount - snapshotCount,
          matches: currentCount === snapshotCount
        },
        currentVsHistorical: {
          currentCount,
          historicalCount: historicalSum,
          difference: currentCount - historicalSum,
          note: 'These should differ if projects changed between dates'
        }
      }
    });
    
  } catch (error) {
    console.error('Error in verification:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run verification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

