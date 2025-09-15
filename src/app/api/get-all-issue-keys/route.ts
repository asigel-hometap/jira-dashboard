import { NextRequest, NextResponse } from 'next/server';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET(request: NextRequest) {
  try {
    const allIssues = await getAllIssuesForCycleAnalysis();
    
    const issueKeys = allIssues.map(issue => ({
      key: issue.key,
      status: issue.fields.status.name,
      created: issue.fields.created,
      summary: issue.fields.summary
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        totalIssues: issueKeys.length,
        issueKeys: issueKeys
      }
    });
    
  } catch (error) {
    console.error('Error getting all issue keys:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get issue keys',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
