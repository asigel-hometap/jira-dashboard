import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Get all active issues for Adam Sigel
    const issues = await dbService.getActiveIssues();
    const adamIssues = issues.filter(issue => issue.assignee === 'Adam Sigel');
    
    // Separate by health status
    const issuesByHealth = {
      onTrack: adamIssues.filter(issue => issue.health === 'On Track'),
      atRisk: adamIssues.filter(issue => issue.health === 'At Risk'),
      offTrack: adamIssues.filter(issue => issue.health === 'Off Track'),
      onHold: adamIssues.filter(issue => issue.health === 'On Hold'),
      mystery: adamIssues.filter(issue => issue.health === 'Mystery'),
      complete: adamIssues.filter(issue => issue.health === 'Complete'),
      unknown: adamIssues.filter(issue => !issue.health || issue.health === 'Unknown')
    };
    
    // Get active issues (excluding Complete)
    const activeIssues = adamIssues.filter(issue => issue.health !== 'Complete');
    
    return NextResponse.json({
      success: true,
      data: {
        totalIssues: adamIssues.length,
        activeIssues: activeIssues.length,
        issuesByHealth: {
          onTrack: issuesByHealth.onTrack.map(issue => ({
            key: issue.key,
            summary: issue.summary,
            status: issue.status,
            health: issue.health,
            assignee: issue.assignee
          })),
          atRisk: issuesByHealth.atRisk.map(issue => ({
            key: issue.key,
            summary: issue.summary,
            status: issue.status,
            health: issue.health,
            assignee: issue.assignee
          })),
          offTrack: issuesByHealth.offTrack.map(issue => ({
            key: issue.key,
            summary: issue.summary,
            status: issue.status,
            health: issue.health,
            assignee: issue.assignee
          })),
          onHold: issuesByHealth.onHold.map(issue => ({
            key: issue.key,
            summary: issue.summary,
            status: issue.status,
            health: issue.health,
            assignee: issue.assignee
          })),
          mystery: issuesByHealth.mystery.map(issue => ({
            key: issue.key,
            summary: issue.summary,
            status: issue.status,
            health: issue.health,
            assignee: issue.assignee
          })),
          complete: issuesByHealth.complete.map(issue => ({
            key: issue.key,
            summary: issue.summary,
            status: issue.status,
            health: issue.health,
            assignee: issue.assignee
          })),
          unknown: issuesByHealth.unknown.map(issue => ({
            key: issue.key,
            summary: issue.summary,
            status: issue.status,
            health: issue.health,
            assignee: issue.assignee
          }))
        },
        activeIssuesList: activeIssues.map(issue => ({
          key: issue.key,
          summary: issue.summary,
          status: issue.status,
          health: issue.health,
          assignee: issue.assignee
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching Adam\'s projects:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
