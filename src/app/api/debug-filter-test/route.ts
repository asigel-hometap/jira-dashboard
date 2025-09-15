import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Get all active issues for Jacqueline Gallagher
    const issues = await dbService.getActiveIssues();
    const jacquelineIssues = issues.filter(issue => issue.assignee === 'Jacqueline Gallagher');
    
    // Test the filter logic
    const testFilter = (issue: any) => {
      const hasCompleteHealth = issue.health === 'Complete';
      const statusStartsWith08 = issue.status.startsWith('08');
      const shouldExclude = hasCompleteHealth && statusStartsWith08;
      const shouldInclude = !shouldExclude;
      
      return {
        key: issue.key,
        status: issue.status,
        health: issue.health,
        hasCompleteHealth,
        statusStartsWith08,
        shouldExclude,
        shouldInclude
      };
    };
    
    const filterResults = jacquelineIssues.map(testFilter);
    
    return NextResponse.json({
      success: true,
      data: {
        totalIssues: jacquelineIssues.length,
        filterResults
      }
    });
  } catch (error) {
    console.error('Error testing filter:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
