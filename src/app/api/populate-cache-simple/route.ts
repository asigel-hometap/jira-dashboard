import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService } from '@/lib/database-factory';

export async function POST(request: NextRequest) {
  try {
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    console.log('Starting simple cycle time cache population...');
    
    // Get a few sample issues to process
    const issues = await dbService.getActiveIssues();
    const sampleIssues = issues.slice(0, 5); // Just process 5 issues
    
    console.log(`Processing ${sampleIssues.length} sample issues...`);
    
    for (const issue of sampleIssues) {
      try {
        const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(issue.key);
        
        // Cache the result
        const completionDate = cycleInfo.discoveryEndDate;
        const quarter = completionDate ? dataProcessor.getQuarterFromDate(completionDate) : null;
        
        await dbService.insertCycleTimeCache(issue.key, {
          discoveryStartDate: cycleInfo.discoveryStartDate,
          discoveryEndDate: cycleInfo.discoveryEndDate,
          endDateLogic: cycleInfo.endDateLogic,
          calendarDaysInDiscovery: cycleInfo.calendarDaysInDiscovery,
          activeDaysInDiscovery: cycleInfo.activeDaysInDiscovery,
          completionQuarter: quarter
        });
        
        console.log(`Cached cycle info for ${issue.key}: ${cycleInfo.endDateLogic}`);
      } catch (error) {
        console.error(`Error processing ${issue.key}:`, error);
      }
    }
    
    // Check cache after population
    const cacheAfter = await dbService.getCycleTimeCache();
    
    return NextResponse.json({
      success: true,
      message: `Cycle time cache populated with ${cacheAfter.length} entries`,
      data: {
        cacheCount: cacheAfter.length,
        sampleEntries: cacheAfter.slice(0, 3)
      }
    });
  } catch (error) {
    console.error('Error populating cycle time cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to populate cycle time cache'
      },
      { status: 500 }
    );
  }
}
