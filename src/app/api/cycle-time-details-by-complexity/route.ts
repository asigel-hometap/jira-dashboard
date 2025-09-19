import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    const { searchParams } = new URL(request.url);
    const complexity = searchParams.get('complexity');
    const timeType = searchParams.get('timeType') || 'calendar';

    if (!complexity) {
      return NextResponse.json(
        { success: false, error: 'Complexity parameter is required' },
        { status: 400 }
      );
    }

    // Get all completed discovery cycles from cache
    const cycleTimeCache = await dbService.getCycleTimeCache();
    
    // Get excluded issues
    const excludedIssues = await dbService.getExcludedIssues();
    
    // Filter for completed discovery cycles with the specified complexity
    const projects = [];

    for (const cached of cycleTimeCache) {
      // Skip excluded issues
      if (excludedIssues.includes(cached.issueKey)) {
        continue;
      }
      
      // Only include projects with completed discovery cycles
      if (cached.discoveryStartDate && 
          cached.discoveryEndDate && 
          cached.endDateLogic !== 'Still in Discovery' &&
          cached.endDateLogic !== 'No Discovery' &&
          cached.endDateLogic !== 'Direct to Build') {
        
        // Get the issue details to find discovery complexity
        let issue = null;
        try {
          issue = await dbService.getIssueByKey(cached.issueKey);
        } catch (error) {
          // Issue not in database, that's okay
        }
        
        const discoveryComplexity = issue?.discoveryComplexity || 'Not Set';
        
        // Only include projects with the specified complexity
        if (discoveryComplexity === complexity) {
          const cycleTime = timeType === 'active' 
            ? (cached.activeDaysInDiscovery || 0)
            : (cached.calendarDaysInDiscovery || 0);
          
          if (cycleTime > 0) {
            projects.push({
              key: cached.issueKey,
              summary: issue?.summary || `Project ${cached.issueKey}`,
              assignee: issue?.assignee || 'Unknown',
              discoveryComplexity: discoveryComplexity,
              discoveryStart: cached.discoveryStartDate.toISOString().split('T')[0],
              activeDiscoveryTime: cached.activeDaysInDiscovery || 0,
              calendarDiscoveryTime: cached.calendarDaysInDiscovery || 0,
              discoveryEnd: cached.discoveryEndDate?.toISOString().split('T')[0] || null,
              endDateLogic: cached.endDateLogic || 'Still in Discovery'
            });
          }
        }
      }
    }

    // Sort by cycle time (descending)
    projects.sort((a, b) => {
      const aTime = timeType === 'active' ? a.activeDiscoveryTime : a.calendarDiscoveryTime;
      const bTime = timeType === 'active' ? b.activeDiscoveryTime : b.calendarDiscoveryTime;
      return bTime - aTime;
    });

    return NextResponse.json({
      success: true,
      data: projects
    });

  } catch (error) {
    console.error('Error fetching cycle time details by complexity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cycle time details by complexity' },
      { status: 500 }
    );
  }
}
