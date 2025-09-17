import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');
    const assignee = searchParams.get('assignee');
    const includeInactivePeriods = searchParams.get('includeInactivePeriods') === 'true';

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

    // Apply assignee filter if provided (exact match)
    let filteredProjects = discoveryProjects;
    if (assignee) {
      console.log(`Filtering by assignee: "${assignee}"`);
      filteredProjects = discoveryProjects.filter(project => 
        project.assignee && project.assignee === assignee
      );
      console.log(`Filtered to ${filteredProjects.length} projects for assignee "${assignee}"`);
    }

    // Get discovery cycle info for each project (use cache first)
    const ganttData = await Promise.all(filteredProjects.map(async (project) => {
      try {
        // Try to get from cache first
        const cachedData = await dbService.getCycleTimeCacheByIssue(project.key);
        
        if (cachedData && cachedData.length > 0) {
          const cache = cachedData[0];
          console.log(`Using cached data for ${project.key} (assignee: ${project.assignee})`);
          
          // Parse inactive periods from cache
          let inactivePeriods = [];
          if (includeInactivePeriods && cache.inactive_periods) {
            try {
              const parsed = JSON.parse(cache.inactive_periods);
              inactivePeriods = parsed.map((p: any) => ({
                start: new Date(p.start),
                end: new Date(p.end)
              }));
            } catch (error) {
              console.warn(`Error parsing inactive periods for ${project.key}:`, error);
              inactivePeriods = [];
            }
          }
          
          // Handle projects still in discovery
          const discoveryEnd = cache.discovery_end_date 
            ? cache.discovery_end_date.split('T')[0]
            : new Date().toISOString().split('T')[0];
          
          return {
            projectKey: project.key,
            projectName: project.summary,
            assignee: project.assignee, // Use the filtered project's assignee
            discoveryStart: cache.discovery_start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
            discoveryEnd: discoveryEnd,
            endDateLogic: cache.end_date_logic || 'Still in Discovery',
            calendarDays: cache.calendar_days_in_discovery || 0,
            activeDays: cache.active_days_in_discovery || 0,
            inactivePeriods: inactivePeriods.map(period => ({
              start: period.start.toISOString().split('T')[0],
              end: period.end.toISOString().split('T')[0]
            })),
            isStillInDiscovery: !cache.discovery_end_date
          };
        }
        
        // Fallback to real-time calculation if not cached
        console.log(`No cache found for ${project.key}, calculating in real-time`);
        const { getDataProcessor } = await import('@/lib/data-processor');
        const dataProcessor = getDataProcessor();
        
        const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(project.key);
        
        // Get inactive periods for this project (only if requested and with timeout)
        let inactivePeriods = [];
        if (includeInactivePeriods) {
          try {
            const inactivePeriodsPromise = dataProcessor.getInactivePeriods(
              project.key, 
              cycleInfo.discoveryStartDate || undefined, 
              cycleInfo.discoveryEndDate || undefined
            );
            
            // Add a 5-second timeout for inactive periods to prevent hanging
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            );
            
            inactivePeriods = await Promise.race([inactivePeriodsPromise, timeoutPromise]);
          } catch (error) {
            console.warn(`Timeout or error getting inactive periods for ${project.key}:`, error.message);
            inactivePeriods = [];
          }
        }
        
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
          inactivePeriods: inactivePeriods.map(period => ({
            start: period.start.toISOString().split('T')[0],
            end: period.end.toISOString().split('T')[0]
          })),
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
          inactivePeriods: [],
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
