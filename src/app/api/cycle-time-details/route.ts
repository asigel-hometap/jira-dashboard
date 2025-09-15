import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');

    if (!quarter) {
      return NextResponse.json(
        { success: false, error: 'Quarter parameter is required' },
        { status: 400 }
      );
    }

    // First, try to get cached data
    const cachedProjects = await dbService.getProjectDetailsCache(quarter);
    
    if (cachedProjects.length > 0) {
      console.log(`Using cached project details for ${quarter}: ${cachedProjects.length} projects`);
      
      return NextResponse.json({
        success: true,
        data: cachedProjects.map(project => ({
          key: project.issueKey,
          summary: project.summary,
          assignee: project.assignee,
          discoveryStart: project.discoveryStartDate,
          activeDiscoveryTime: project.activeDaysInDiscovery,
          calendarDiscoveryTime: project.calendarDaysInDiscovery
        }))
      });
    }

    // If no cached data, use cycle time cache to build project details
    console.log(`No cached data for ${quarter}, using cycle time cache...`);
    
    // Get all cached cycle time data
    const cycleTimeCache = await dbService.getCycleTimeCache();
    
    // Filter for completed discovery cycles in the specified quarter
    const completedProjects = [];
    
    for (const cached of cycleTimeCache) {
      // Check if this is a completed discovery cycle in the specified quarter
      if (cached.discoveryStartDate && 
          cached.discoveryEndDate && 
          cached.endDateLogic !== 'Still in Discovery' &&
          cached.endDateLogic !== 'No Discovery' &&
          cached.endDateLogic !== 'Direct to Build' &&
          cached.completionQuarter === quarter) {
        
        // Try to get issue details from database first
        let issue = null;
        try {
          issue = await dbService.getIssueByKey(cached.issueKey);
        } catch (error) {
          // Issue not in database, that's okay
          console.log(`Issue ${cached.issueKey} not found in database, using fallback data`);
        }
        
        // If not in database, try to get from Jira API for better data
        let summary = issue?.summary || `Project ${cached.issueKey}`;
        let assignee = issue?.assignee || 'Unknown';
        
        if (!issue) {
          try {
            // Import Jira API function
            const { getAllIssuesForCycleAnalysis } = await import('@/lib/jira-api');
            const allIssues = await getAllIssuesForCycleAnalysis();
            const jiraIssue = allIssues.find(i => i.key === cached.issueKey);
            
            if (jiraIssue) {
              summary = jiraIssue.fields.summary;
              assignee = jiraIssue.fields.assignee?.displayName || 'Unknown';
              console.log(`Found Jira data for ${cached.issueKey}: ${summary}`);
            }
          } catch (error) {
            console.log(`Could not fetch Jira data for ${cached.issueKey}:`, error);
          }
        }
        
        completedProjects.push({
          issueKey: cached.issueKey,
          summary: summary,
          assignee: assignee,
          discoveryStartDate: cached.discoveryStartDate.toISOString().split('T')[0],
          calendarDaysInDiscovery: cached.calendarDaysInDiscovery || 0,
          activeDaysInDiscovery: cached.activeDaysInDiscovery || 0
        });
      }
    }

    // Cache the results
    for (const project of completedProjects) {
      await dbService.insertProjectDetailsCache({
        quarter,
        issueKey: project.issueKey,
        summary: project.summary,
        assignee: project.assignee,
        discoveryStartDate: project.discoveryStartDate,
        calendarDaysInDiscovery: project.calendarDaysInDiscovery,
        activeDaysInDiscovery: project.activeDaysInDiscovery,
        calculatedAt: new Date().toISOString()
      });
    }
    console.log(`Cached ${completedProjects.length} projects for ${quarter}`);

    return NextResponse.json({
      success: true,
      data: completedProjects.map(project => ({
        key: project.issueKey,
        summary: project.summary,
        assignee: project.assignee,
        discoveryStart: project.discoveryStartDate,
        activeDiscoveryTime: project.activeDaysInDiscovery,
        calendarDiscoveryTime: project.calendarDaysInDiscovery
      }))
    });

  } catch (error) {
    console.error('Error fetching cycle time details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cycle time details' },
      { status: 500 }
    );
  }
}

function getQuarterFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  
  if (month >= 1 && month <= 3) return `Q1_${year}`;
  if (month >= 4 && month <= 6) return `Q2_${year}`;
  if (month >= 7 && month <= 9) return `Q3_${year}`;
  if (month >= 10 && month <= 12) return `Q4_${year}`;
  
  return `Q1_${year}`; // fallback
}
