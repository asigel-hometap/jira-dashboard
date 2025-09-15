import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET(request: NextRequest) {
  try {
    const dbService = getDatabaseService();
    
    // Get all issues from Jira
    const allIssues = await getAllIssuesForCycleAnalysis();
    const allIssueKeys = allIssues.map(issue => issue.key);
    
    // Get cached issues
    const cachedData = await dbService.getCycleTimeCache();
    const cachedIssueKeys = new Set(cachedData.map(item => item.key));
    
    // Find uncached issues
    const uncachedIssues = allIssues.filter(issue => !cachedIssueKeys.has(issue.key));
    
    // Calculate progress
    const totalIssues = allIssues.length;
    const cachedCount = cachedData.length;
    const uncachedCount = totalIssues - cachedCount; // Fix: Calculate correctly
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
    
    // Sample uncached issues
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
        allIssueKeys: allIssueKeys.slice(0, 50), // First 50 for reference
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
