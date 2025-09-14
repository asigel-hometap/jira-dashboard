import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    const dbService = getDatabaseService();
    
    // Get cycle time cache data
    const cycleCache = await dbService.getCycleTimeCache();
    
    // Get some sample issues to see what we're working with
    const issues = await dbService.getActiveIssues();
    const sampleIssues = issues.slice(0, 5).map(issue => ({
      key: issue.key,
      status: issue.status,
      health: issue.health,
      created: issue.created,
      updated: issue.updated
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        cycleCacheCount: cycleCache.length,
        cycleCacheSample: cycleCache.slice(0, 3),
        totalIssues: issues.length,
        sampleIssues,
        quarters: [...new Set(cycleCache.map(c => c.completionQuarter).filter(Boolean))]
      }
    });
  } catch (error) {
    console.error('Error debugging cycle cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to debug cycle cache'
      },
      { status: 500 }
    );
  }
}
