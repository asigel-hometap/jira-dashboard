import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Get all active issues
    const allActiveIssues = await dbService.getActiveIssues();
    const jacquelineIssues = allActiveIssues.filter(issue => issue.assignee === 'Jacqueline Gallagher');
    
    return NextResponse.json({
      success: true,
      data: {
        totalActiveIssues: allActiveIssues.length,
        jacquelineActiveIssues: jacquelineIssues.length,
        jacquelineIssues: jacquelineIssues.map(issue => ({
          key: issue.key,
          summary: issue.summary,
          status: issue.status,
          health: issue.health,
          assignee: issue.assignee
        }))
      }
    });
  } catch (error) {
    console.error('Error testing getActiveIssues:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
