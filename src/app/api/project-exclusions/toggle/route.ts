import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';

export async function POST(request: NextRequest) {
  try {
    const { issueKey, excludedBy, reason } = await request.json();
    
    if (!issueKey || !excludedBy) {
      return NextResponse.json(
        { success: false, error: 'issueKey and excludedBy are required' },
        { status: 400 }
      );
    }

    const dbService = getDatabaseService();
    const isExcluded = await dbService.toggleExclusion(issueKey, excludedBy, reason);
    
    return NextResponse.json({
      success: true,
      data: {
        issueKey,
        isExcluded
      },
      message: isExcluded ? 'Project excluded' : 'Project included'
    });
  } catch (error) {
    console.error('Error toggling project exclusion:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
