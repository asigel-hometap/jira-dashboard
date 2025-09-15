import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';

// Cache the issue list to avoid re-fetching
let cachedIssueList: any[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedIssueList() {
  const now = Date.now();
  
  // Return cached list if it's still fresh
  if (cachedIssueList && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedIssueList;
  }
  
  // Fetch fresh list
  const { getAllIssuesForCycleAnalysis } = await import('@/lib/jira-api');
  cachedIssueList = await getAllIssuesForCycleAnalysis();
  lastFetchTime = now;
  
  return cachedIssueList;
}

export async function GET(request: NextRequest) {
  try {
    const dbService = getDatabaseService();
    
    // Get cached issues from database
    const cachedData = await dbService.getCycleTimeCache();
    const cachedIssueKeys = new Set(cachedData.map(item => item.key));
    
    // Get issue list (cached for 5 minutes)
    const allIssues = await getCachedIssueList();
    
    // Calculate progress
    const totalIssues = allIssues.length;
    const cachedCount = cachedData.length;
    const uncachedCount = totalIssues - cachedCount;
    const progressPercentage = Math.round((cachedCount / totalIssues) * 100);
    
    // Get quarter distribution
    const quarterValues = cachedData.map(item => item.completionQuarter).filter(q => q);
    const quarterCounts = [...new Set(quarterValues)].map(quarter => ({
      quarter,
      count: quarterValues.filter(q => q === quarter).length
    })).sort((a, b) => a.quarter.localeCompare(b.quarter));
    
    // Get status distribution
    const endDateLogicValues = cachedData.map(item => item.endDateLogic);
    const uniqueValues = [...new Set(endDateLogicValues)];
    const statusCounts = uniqueValues.map(value => ({
      value,
      count: endDateLogicValues.filter(v => v === value).length
    }));
    
    // Sample uncached issues (only if we have uncached issues)
    const uncachedIssues = allIssues.filter(issue => !cachedIssueKeys.has(issue.key));
    const sampleUncached = uncachedIssues.slice(0, 10).map(issue => ({
      key: issue.key,
      status: issue.fields.status.name,
      created: issue.fields.created,
      summary: issue.fields.summary?.substring(0, 50) + '...'
    }));
    
    // Sample cached issues
    const sampleCached = cachedData.slice(0, 10).map(item => ({
      key: item.issueKey,
      endDateLogic: item.endDateLogic,
      completionQuarter: item.completionQuarter,
      calendarDays: item.calendarDaysInDiscovery
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        progress: {
          totalIssues,
          cachedCount,
          uncachedCount,
          progressPercentage,
          lastUpdated: new Date().toISOString()
        },
        quarterDistribution: quarterCounts,
        statusDistribution: statusCounts,
        sampleUncached,
        sampleCached,
        allIssueKeys: allIssues.map(issue => issue.key).slice(0, 50), // First 50 for reference
        uncachedIssueKeys: uncachedIssues.map(issue => issue.key).slice(0, 50) // First 50 uncached
      }
    });
    
  } catch (error) {
    console.error('Error getting processing status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get processing status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
