import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { DataProcessor } from '@/lib/data-processor';

export async function GET() {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    console.log('=== Testing HT-156 Fix ===');

    // Clear the cached data for HT-156
    await dbService.clearCycleTimeCache();
    console.log('Cleared cycle time cache');

    // Recalculate using the fixed logic
    const dataProcessor = new DataProcessor();
    const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo('HT-156');
    
    console.log('Recalculated cycle info:', cycleInfo);

    // Cache the new result
    const completionDate = cycleInfo.discoveryEndDate;
    const quarter = completionDate ? dataProcessor.getQuarterFromDate(completionDate) : null;
    
    await dbService.insertCycleTimeCache('HT-156', {
      discoveryStartDate: cycleInfo.discoveryStartDate,
      discoveryEndDate: cycleInfo.discoveryEndDate,
      endDateLogic: cycleInfo.endDateLogic,
      calendarDaysInDiscovery: cycleInfo.calendarDaysInDiscovery,
      activeDaysInDiscovery: cycleInfo.activeDaysInDiscovery,
      completionQuarter: quarter
    });

    console.log('Cached new result');

    // Get the cached data to verify
    const cachedData = await dbService.getCycleTimeCacheByIssue('HT-156');
    console.log('Cached data after fix:', cachedData);

    return NextResponse.json({
      success: true,
      data: {
        cycleInfo,
        cachedData,
        quarter
      }
    });

  } catch (error: any) {
    console.error('Error testing HT-156 fix:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
