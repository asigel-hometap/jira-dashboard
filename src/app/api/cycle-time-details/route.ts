import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';
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

    // If no cached data, calculate and cache it
    console.log(`No cached data for ${quarter}, calculating...`);
    const dataProcessor = getDataProcessor();
    const { getAllIssuesForCycleAnalysis } = await import('@/lib/jira-api');
    const allIssues = await getAllIssuesForCycleAnalysis();
    
    // Filter for completed discovery cycles in the specified quarter
    const completedProjects = [];
    
    for (const issue of allIssues) {
      const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(issue.key);
      
      // Check if this is a completed discovery cycle
      if (cycleInfo.discoveryStartDate && 
          cycleInfo.discoveryEndDate && 
          cycleInfo.endDateLogic !== 'Still in Discovery' &&
          cycleInfo.endDateLogic !== 'No Discovery' &&
          cycleInfo.endDateLogic !== 'Direct to Build') {
        
        // Check if completion quarter matches
        const completionDate = cycleInfo.discoveryEndDate;
        const completionQuarter = getQuarterFromDate(completionDate);
        
        if (completionQuarter === quarter) {
          completedProjects.push({
            issueKey: issue.key,
            summary: issue.fields.summary,
            assignee: issue.fields.assignee?.displayName || 'Unassigned',
            discoveryStartDate: cycleInfo.discoveryStartDate.toISOString().split('T')[0],
            calendarDaysInDiscovery: cycleInfo.calendarDaysInDiscovery || 0,
            activeDaysInDiscovery: cycleInfo.activeDaysInDiscovery || 0
          });
        }
      }
    }

    // Cache the results
    await dbService.insertProjectDetailsCache(quarter, completedProjects);
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
