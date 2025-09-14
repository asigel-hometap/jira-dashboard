import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService } from '@/lib/database-factory';

export async function POST(request: NextRequest) {
  try {
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    // Test with HT-475 which we know works
    const issueKey = 'HT-475';
    console.log(`Testing cache insert for ${issueKey}...`);
    
    const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(issueKey);
    console.log(`Cycle info:`, cycleInfo);
    
    const completionDate = cycleInfo.discoveryEndDate;
    const quarter = completionDate ? dataProcessor.getQuarterFromDate(completionDate) : null;
    
    // Try to insert into cache
    await dbService.insertCycleTimeCache(issueKey, {
      discoveryStartDate: cycleInfo.discoveryStartDate,
      discoveryEndDate: cycleInfo.discoveryEndDate,
      endDateLogic: cycleInfo.endDateLogic,
      calendarDaysInDiscovery: cycleInfo.calendarDaysInDiscovery,
      activeDaysInDiscovery: cycleInfo.activeDaysInDiscovery,
      completionQuarter: quarter
    });
    
    console.log(`Cache insert completed for ${issueKey}`);
    
    // Check if it was actually inserted
    const cacheAfter = await dbService.getCycleTimeCache();
    
    return NextResponse.json({
      success: true,
      message: `Cache insert test completed`,
      data: {
        issueKey,
        cycleInfo,
        quarter,
        cacheCount: cacheAfter.length,
        cacheEntries: cacheAfter.filter(c => c.issueKey === issueKey)
      }
    });
  } catch (error) {
    console.error('Error testing cache insert:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test cache insert',
        details: error.message
      },
      { status: 500 }
    );
  }
}
