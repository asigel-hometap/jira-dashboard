import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();

    const { issueKeys } = await request.json();

    if (!issueKeys || !Array.isArray(issueKeys) || issueKeys.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No issue keys provided' },
        { status: 400 }
      );
    }

    console.log(`Recalculating cycle time cache for ${issueKeys.length} issues`);

    const recalculatedIssues = [];

    for (const issueKey of issueKeys) {
      try {
        // Get the issue from database
        const issue = await dbService.getIssueByKey(issueKey);
        if (!issue) {
          console.log(`Issue ${issueKey} not found in database, skipping`);
          continue;
        }

        // Recalculate cycle time info for this issue
        const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(issueKey);
        
        // Get inactive periods for caching
        let inactivePeriods: Array<{start: Date, end: Date}> = [];
        try {
          if (cycleInfo.discoveryStartDate && cycleInfo.discoveryEndDate) {
            inactivePeriods = await dataProcessor.getInactivePeriods(
              issueKey, 
              cycleInfo.discoveryStartDate, 
              cycleInfo.discoveryEndDate
            );
          }
        } catch (error) {
          console.error(`Error getting inactive periods for ${issueKey}:`, error);
        }
        
        // Cache the result
        const completionDate = cycleInfo.discoveryEndDate;
        const quarter = completionDate ? dataProcessor.getQuarterFromDate(completionDate) : null;
        
        await dbService.insertCycleTimeCache(issueKey, {
          discoveryStartDate: cycleInfo.discoveryStartDate,
          discoveryEndDate: cycleInfo.discoveryEndDate,
          endDateLogic: cycleInfo.endDateLogic,
          calendarDaysInDiscovery: cycleInfo.calendarDaysInDiscovery,
          activeDaysInDiscovery: cycleInfo.activeDaysInDiscovery,
          completionQuarter: quarter,
          inactivePeriods: inactivePeriods
        });

        recalculatedIssues.push(issueKey);
        console.log(`Recalculated cycle time cache for ${issueKey}`);
      } catch (error) {
        console.error(`Error recalculating cycle time cache for ${issueKey}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        recalculatedIssues: recalculatedIssues,
        count: recalculatedIssues.length
      }
    });

  } catch (error) {
    console.error('Error recalculating cycle time cache:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to recalculate cycle time cache' },
      { status: 500 }
    );
  }
}
