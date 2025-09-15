import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const issueKey = searchParams.get('issueKey');
  
  if (!issueKey) {
    return NextResponse.json(
      { success: false, error: 'issueKey parameter is required' },
      { status: 400 }
    );
  }
  
  try {
    
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    console.log(`Processing single issue: ${issueKey}`);
    
    // Check if already cached
    const existingCache = await dbService.getCycleTimeCacheByIssue(issueKey);
    if (existingCache) {
      return NextResponse.json({
        success: true,
        message: 'Issue already cached',
        data: {
          issueKey,
          cached: true,
          existingData: existingCache
        }
      });
    }
    
    // Process the issue
    const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(issueKey);
    
    // Cache the result
    const completionDate = cycleInfo.discoveryEndDate;
    const quarter = completionDate ? dataProcessor.getQuarterFromDate(completionDate) : null;
    
    await dbService.insertCycleTimeCache(issueKey, {
      discoveryStartDate: cycleInfo.discoveryStartDate,
      discoveryEndDate: cycleInfo.discoveryEndDate,
      endDateLogic: cycleInfo.endDateLogic,
      calendarDaysInDiscovery: cycleInfo.calendarDaysInDiscovery,
      activeDaysInDiscovery: cycleInfo.activeDaysInDiscovery,
      completionQuarter: quarter
    });
    
    console.log(`Successfully processed ${issueKey}: ${cycleInfo.endDateLogic}`);
    
    return NextResponse.json({
      success: true,
      message: 'Issue processed successfully',
      data: {
        issueKey,
        cached: false,
        cycleInfo: {
          discoveryStartDate: cycleInfo.discoveryStartDate,
          discoveryEndDate: cycleInfo.discoveryEndDate,
          endDateLogic: cycleInfo.endDateLogic,
          calendarDaysInDiscovery: cycleInfo.calendarDaysInDiscovery,
          activeDaysInDiscovery: cycleInfo.activeDaysInDiscovery,
          completionQuarter: quarter
        }
      }
    });
    
  } catch (error) {
    console.error(`Error processing issue ${issueKey || 'unknown'}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process issue',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
