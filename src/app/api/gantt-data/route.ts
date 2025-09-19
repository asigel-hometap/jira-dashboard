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
    
    console.log(`Gantt API called with quarter=${quarter}, assignee=${assignee}, includeInactivePeriods=${includeInactivePeriods}`);

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
    // Process projects in batches to avoid overwhelming the API
    const batchSize = 5;
    const ganttData = [];
    
    for (let i = 0; i < filteredProjects.length; i += batchSize) {
      const batch = filteredProjects.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filteredProjects.length / batchSize)} (${batch.length} projects)`);
      
      const batchResults = await Promise.all(batch.map(async (project) => {
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
              inactivePeriods = parsed.map((p: { start: string; end: string }) => ({
                start: new Date(p.start),
                end: new Date(p.end)
              }));
              console.log(`Found ${inactivePeriods.length} cached inactive periods for ${project.key}`);
            } catch (error) {
              console.warn(`Error parsing inactive periods for ${project.key}:`, error);
              inactivePeriods = [];
            }
          } else if (includeInactivePeriods) {
            console.log(`No cached inactive periods for ${project.key} (includeInactivePeriods=${includeInactivePeriods}, hasCache=${!!cache.inactive_periods})`);
          }
          
          // Handle projects still in discovery
          const discoveryEnd = cache.discovery_end_date 
            ? cache.discovery_end_date.split('T')[0]
            : new Date().toISOString().split('T')[0];
          
          return {
            projectKey: project.key,
            projectName: project.summary,
            assignee: project.assignee, // Use the filtered project's assignee
            discoveryComplexity: project.discoveryComplexity,
            discoveryStart: cache.discovery_start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
            discoveryEnd: discoveryEnd,
            endDateLogic: cache.end_date_logic || 'Still in Discovery',
            calendarDays: cache.calendar_days_in_discovery || 0,
            activeDays: cache.active_days_in_discovery || 0,
            inactivePeriods: inactivePeriods.map((period: { start: Date; end: Date }) => ({
              start: period.start.toISOString().split('T')[0],
              end: period.end.toISOString().split('T')[0]
            })),
            isStillInDiscovery: !cache.discovery_end_date
          };
        }
        
        // Fallback to real-time calculation if not cached (with timeout)
        console.log(`No cache found for ${project.key}, calculating in real-time`);
        const { getDataProcessor } = await import('@/lib/data-processor');
        const dataProcessor = getDataProcessor();
        
        // Add timeout to prevent hanging
        const cycleInfoPromise = dataProcessor.calculateDiscoveryCycleInfo(project.key);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout calculating cycle info')), 5000)
        );
        
        let cycleInfo;
        try {
          cycleInfo = await Promise.race([cycleInfoPromise, timeoutPromise]) as any;
        } catch (error) {
          console.warn(`Timeout or error calculating cycle info for ${project.key}:`, error instanceof Error ? error.message : String(error));
          // Return fallback data for this project
          return {
            projectKey: project.key,
            projectName: project.summary,
            assignee: project.assignee,
            discoveryComplexity: project.discoveryComplexity,
            discoveryStart: new Date().toISOString().split('T')[0],
            discoveryEnd: new Date().toISOString().split('T')[0],
            endDateLogic: 'Error',
            calendarDays: 0,
            activeDays: 0,
            inactivePeriods: [],
            isStillInDiscovery: true
          };
        }
        
        // Get inactive periods for this project (only if requested and with shorter timeout)
        let inactivePeriods = [];
        if (includeInactivePeriods) {
          try {
            const inactivePeriodsPromise = dataProcessor.getInactivePeriods(
              project.key, 
              cycleInfo.discoveryStartDate || undefined, 
              cycleInfo.discoveryEndDate || undefined
            );
            
            // Add a 2-second timeout for inactive periods to prevent hanging
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 2000)
            );
            
            inactivePeriods = await Promise.race([inactivePeriodsPromise, timeoutPromise]) as any[];
          } catch (error) {
            console.warn(`Timeout or error getting inactive periods for ${project.key}:`, error instanceof Error ? error.message : String(error));
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
          discoveryComplexity: project.discoveryComplexity,
          discoveryStart: cycleInfo.discoveryStartDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          discoveryEnd: discoveryEnd,
          endDateLogic: endDateLogic,
          calendarDays: cycleInfo.calendarDaysInDiscovery || 0,
          activeDays: cycleInfo.activeDaysInDiscovery || 0,
          inactivePeriods: inactivePeriods.map((period: { start: Date; end: Date }) => ({
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
          discoveryComplexity: project.discoveryComplexity,
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
      
      ganttData.push(...batchResults);
    }

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
