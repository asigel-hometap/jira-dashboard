import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService, initializeDatabase } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const { searchParams } = new URL(request.url);
    const chunkSize = parseInt(searchParams.get('chunkSize') || '20');
    const startIndex = parseInt(searchParams.get('startIndex') || '0');
    
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    console.log(`Processing optimized chunk: start=${startIndex}, size=${chunkSize}`);
    
    // Get ALL issues from Jira API
    const allIssues = await getAllIssuesForCycleAnalysis();
    console.log(`Total issues available: ${allIssues.length}`);
    
    // Pre-filter projects that are likely to have discovery cycles
    const filteredIssues = allIssues.filter(issue => {
      const status = issue.fields.status.name;
      const created = new Date(issue.fields.created);
      const updated = new Date(issue.fields.updated);
      
      // Skip very old projects (before 2024) that are unlikely to have discovery cycles
      if (created.getFullYear() < 2024) {
        return false;
      }
      
      // Skip projects that are clearly not discovery-related
      if (status === '01 Inbox' && updated < new Date('2024-01-01')) {
        return false;
      }
      
      // Include projects that are in discovery statuses or have been recently updated
      const discoveryStatuses = ['02 Generative Discovery', '04 Problem Discovery', '05 Solution Discovery', '06 Build', '07 Beta', '08 Live'];
      const isDiscoveryRelated = discoveryStatuses.includes(status);
      const isRecentlyActive = updated > new Date('2024-01-01');
      
      return isDiscoveryRelated || isRecentlyActive;
    });
    
    console.log(`Filtered to ${filteredIssues.length} relevant projects (${Math.round(filteredIssues.length/allIssues.length*100)}%)`);
    
    const chunkIssues = filteredIssues.slice(startIndex, startIndex + chunkSize);
    
    if (chunkIssues.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No more relevant issues to process',
        data: {
          processed: 0,
          cached: 0,
          totalProcessed: startIndex,
          hasMore: false,
          totalRelevant: filteredIssues.length
        }
      });
    }
    
    let processedCount = 0;
    let cachedCount = 0;
    let skippedCount = 0;
    
    for (const issue of chunkIssues) {
      try {
        // Skip if already cached
        const existingCache = await dbService.getCycleTimeCacheByIssue(issue.key);
        if (existingCache.length > 0) {
          console.log(`Skipping ${issue.key} - already cached`);
          skippedCount++;
          continue;
        }
        
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
    const hasMore = nextIndex < filteredIssues.length;
    
    return NextResponse.json({
      success: true,
      message: `Processed optimized chunk: ${processedCount} issues, ${cachedCount} with discovery cycles, ${skippedCount} skipped`,
      data: {
        processed: processedCount,
        cached: cachedCount,
        skipped: skippedCount,
        totalProcessed: nextIndex,
        hasMore,
        nextIndex: hasMore ? nextIndex : null,
        totalRelevant: filteredIssues.length
      }
    });
  } catch (error) {
    console.error('Error processing optimized chunk:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process optimized chunk'
      },
      { status: 500 }
    );
  }
}
