import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService } from '@/lib/database-factory';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chunkSize = parseInt(searchParams.get('chunkSize') || '10');
    const startIndex = parseInt(searchParams.get('startIndex') || '0');
    
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    console.log(`Processing chunk: start=${startIndex}, size=${chunkSize}`);
    
    // Get issues for this chunk
    const allIssues = await dbService.getActiveIssues();
    const chunkIssues = allIssues.slice(startIndex, startIndex + chunkSize);
    
    if (chunkIssues.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No more issues to process',
        data: {
          processed: 0,
          totalProcessed: startIndex,
          hasMore: false
        }
      });
    }
    
    let processedCount = 0;
    let cachedCount = 0;
    
    for (const issue of chunkIssues) {
      try {
        console.log(`Processing ${issue.key}...`);
        const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(issue.key);
        
        // Cache the result regardless of completion status
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
        
        processedCount++;
        if (cycleInfo.discoveryStartDate && cycleInfo.discoveryEndDate) {
          cachedCount++;
        }
        
        console.log(`Processed ${issue.key}: ${cycleInfo.endDateLogic} (${cycleInfo.discoveryStartDate ? 'has start' : 'no start'}, ${cycleInfo.discoveryEndDate ? 'has end' : 'no end'})`);
      } catch (error) {
        console.error(`Error processing ${issue.key}:`, error);
        processedCount++; // Count as processed even if failed
      }
    }
    
    const nextIndex = startIndex + chunkSize;
    const hasMore = nextIndex < allIssues.length;
    
    return NextResponse.json({
      success: true,
      message: `Processed chunk: ${processedCount} issues, ${cachedCount} with discovery cycles`,
      data: {
        processed: processedCount,
        cached: cachedCount,
        totalProcessed: nextIndex,
        hasMore,
        nextIndex: hasMore ? nextIndex : null
      }
    });
  } catch (error) {
    console.error('Error processing chunk:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process chunk'
      },
      { status: 500 }
    );
  }
}
