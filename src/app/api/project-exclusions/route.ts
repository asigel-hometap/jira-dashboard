import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    const dbService = getDatabaseService();
    const excludedIssues = await dbService.getExcludedIssues();
    
    return NextResponse.json({
      success: true,
      data: {
        excludedIssues
      }
    });
  } catch (error) {
    console.error('Error fetching project exclusions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

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
    await dbService.addExclusion(issueKey, excludedBy, reason);
    
    return NextResponse.json({
      success: true,
      message: 'Project excluded successfully'
    });
  } catch (error) {
    console.error('Error adding project exclusion:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const issueKey = searchParams.get('issueKey');
    
    if (!issueKey) {
      return NextResponse.json(
        { success: false, error: 'issueKey is required' },
        { status: 400 }
      );
    }

    const dbService = getDatabaseService();
    await dbService.removeExclusion(issueKey);
    
    return NextResponse.json({
      success: true,
      message: 'Project exclusion removed successfully'
    });
  } catch (error) {
    console.error('Error removing project exclusion:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
