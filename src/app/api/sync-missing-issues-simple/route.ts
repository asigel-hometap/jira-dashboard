import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function POST() {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    console.log('Starting simple sync of missing issues...');

    // Get all issue keys from cycle time cache
    const cycleTimeCache = await dbService.getCycleTimeCache();
    const cachedIssueKeys = cycleTimeCache.map(cached => cached.issueKey);
    
    console.log(`Found ${cachedIssueKeys.length} projects in cycle time cache`);

    // Check which ones are missing from issues table
    const missingKeys = [];
    for (const issueKey of cachedIssueKeys) {
      try {
        const existingIssue = await dbService.getIssueByKey(issueKey);
        if (!existingIssue) {
          missingKeys.push(issueKey);
        }
      } catch (error) {
        // Issue not found, add to missing list
        missingKeys.push(issueKey);
      }
    }

    console.log(`Found ${missingKeys.length} missing issues`);

    // For now, just return the count - we'll implement the actual sync later
    return NextResponse.json({
      success: true,
      message: `Found ${missingKeys.length} missing issues`,
      data: {
        totalInCache: cachedIssueKeys.length,
        missingIssues: missingKeys.length,
        sampleMissing: missingKeys.slice(0, 10) // Show first 10 missing
      }
    });

  } catch (error: any) {
    console.error('Error checking missing issues:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
