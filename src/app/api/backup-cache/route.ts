import { NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';

export async function GET() {
  try {
    const dbService = getDatabaseService();
    
    // Get all cached data
    const cycleTimeCache = await dbService.getCycleTimeCache();
    const projectDetailsCache = await dbService.getProjectDetailsCache('Q1_2025'); // Get sample
    const excludedIssues = await dbService.getExcludedIssues();
    
    const backup = {
      timestamp: new Date().toISOString(),
      cycleTimeCache,
      excludedIssues,
      summary: {
        totalCached: cycleTimeCache.length,
        excludedCount: excludedIssues.length,
        quarters: [...new Set(cycleTimeCache.map(c => c.completionQuarter).filter(Boolean))]
      }
    };
    
    return NextResponse.json({ 
      success: true, 
      data: backup,
      message: `Backup created with ${cycleTimeCache.length} cached items and ${excludedIssues.length} exclusions`
    });
  } catch (error: any) {
    console.error('Error creating backup:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
