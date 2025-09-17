import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');
    const assignee = searchParams.get('assignee');

    if (!quarter) {
      return NextResponse.json(
        { success: false, error: 'Quarter parameter is required' },
        { status: 400 }
      );
    }

    // Get all active issues from database (same as table)
    const activeIssues = await dbService.getActiveIssues();
    console.log(`Fetched ${activeIssues.length} active issues from database`);

    // Filter for discovery, build, and beta projects (same as table)
    const discoveryProjects = activeIssues.filter(issue =>
      issue.status === '02 Generative Discovery' ||
      issue.status === '04 Problem Discovery' ||
      issue.status === '05 Solution Discovery' ||
      issue.status === '06 Build' ||
      issue.status === '07 Beta'
    );
    console.log(`Filtered to ${discoveryProjects.length} discovery projects`);

    // Apply assignee filter if provided (case-insensitive partial match)
    let filteredProjects = discoveryProjects;
    if (assignee) {
      console.log(`Filtering by assignee: "${assignee}"`);
      filteredProjects = discoveryProjects.filter(project => 
        project.assignee && project.assignee.toLowerCase().includes(assignee.toLowerCase())
      );
      console.log(`Filtered to ${filteredProjects.length} projects for assignee "${assignee}"`);
    }

    // Get discovery cycle info for each project
    const ganttData = await Promise.all(filteredProjects.map(async (project) => {
      try {
        // Import data processor to calculate discovery cycle info
        const { getDataProcessor } = await import('@/lib/data-processor');
        const dataProcessor = getDataProcessor();
        
        const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(project.key);
        
        // Handle projects still in discovery
        const discoveryEnd = cycleInfo.discoveryEndDate 
          ? cycleInfo.discoveryEndDate.toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]; // Use current date if still in discovery
        
        const endDateLogic = cycleInfo.endDateLogic || 'Still in Discovery';
        
        return {
          projectKey: project.key,
          projectName: project.summary,
          assignee: project.assignee,
          discoveryStart: cycleInfo.discoveryStartDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          discoveryEnd: discoveryEnd,
          endDateLogic: endDateLogic,
          calendarDays: cycleInfo.calendarDaysInDiscovery || 0,
          activeDays: cycleInfo.activeDaysInDiscovery || 0,
          isStillInDiscovery: !cycleInfo.discoveryEndDate
        };
      } catch (error) {
        console.error(`Error processing project ${project.key}:`, error);
        // Return fallback data for this project
        return {
          projectKey: project.key,
          projectName: project.summary,
          assignee: project.assignee,
          discoveryStart: new Date().toISOString().split('T')[0],
          discoveryEnd: new Date().toISOString().split('T')[0],
          endDateLogic: 'Error',
          calendarDays: 0,
          activeDays: 0,
          isStillInDiscovery: true
        };
      }
    }));

    return NextResponse.json({
      success: true,
      data: ganttData
    });

  } catch (error) {
    console.error('Error fetching Gantt data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Gantt data' },
      { status: 500 }
    );
  }
}
