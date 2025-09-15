import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Get all active issues for Jacqueline Gallagher
    const issues = await dbService.getActiveIssues();
    const jacquelineIssues = issues.filter(issue => issue.assignee === 'Jacqueline Gallagher');
    
    // Separate by health status
    const issuesByHealth = {
      onTrack: jacquelineIssues.filter(issue => issue.health === 'On Track'),
      atRisk: jacquelineIssues.filter(issue => issue.health === 'At Risk'),
      offTrack: jacquelineIssues.filter(issue => issue.health === 'Off Track'),
      onHold: jacquelineIssues.filter(issue => issue.health === 'On Hold'),
      mystery: jacquelineIssues.filter(issue => issue.health === 'Mystery'),
      complete: jacquelineIssues.filter(issue => issue.health === 'Complete'),
      unknown: jacquelineIssues.filter(issue => !issue.health || issue.health === 'Unknown')
    };
    
    // Get active issues (excluding Complete only if in Live status 08+)
    const activeIssues = jacquelineIssues.filter(issue => 
      !(issue.health === 'Complete' && issue.status.startsWith('08'))
    );
    
    return NextResponse.json({
      success: true,
      data: {
        totalIssues: jacquelineIssues.length,
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
    console.error('Error fetching Jacqueline\'s projects:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
