import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();

    const { searchParams } = new URL(request.url);
    const timeType = searchParams.get('timeType') || 'active';

    // Get all completed discovery cycles from cache
    const cycleTimeCache = await dbService.getCycleTimeCache();
    
    // Get excluded issues
    const excludedIssues = await dbService.getExcludedIssues();
    
    // Filter for completed discovery cycles and group by complexity
    const complexityGroups: { [key: string]: any[] } = {
      'Simple': [],
      'Standard': [],
      'Complex': [],
      'Not Set': []
    };

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
        const calendarDays = cached.calendarDaysInDiscovery || 0;
        const activeDays = cached.activeDaysInDiscovery || 0;
        const cycleTime = timeType === 'active' ? activeDays : calendarDays;
        
        // Only include projects with valid cycle time data for both calendar and active
        // Both must have positive values, and active cannot exceed calendar
        if (calendarDays > 0 && activeDays > 0 && activeDays <= calendarDays) {
          // Ensure the complexity group exists, fallback to 'Not Set' if unknown
          const complexityKey = complexityGroups[discoveryComplexity] ? discoveryComplexity : 'Not Set';
          complexityGroups[complexityKey].push(cycleTime);
        }
      }
    }

    // Calculate statistics for each complexity group
    const cohorts: { [complexity: string]: any } = {};
    
    Object.entries(complexityGroups).forEach(([complexity, data]) => {
      if (data.length > 0) {
        const sorted = data.sort((a, b) => a - b);
        const n = sorted.length;
        const mean = data.reduce((sum, val) => sum + val, 0) / n;
        const median = n % 2 === 0 
          ? (sorted[n/2 - 1] + sorted[n/2]) / 2
          : sorted[Math.floor(n/2)];
        
        // Calculate quartiles
        const q1Index = Math.floor(n * 0.25);
        const q3Index = Math.floor(n * 0.75);
        const q1 = sorted[q1Index];
        const q3 = sorted[q3Index];
        
        // Calculate outliers (values beyond 1.5 * IQR)
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        const outliers = sorted.filter(val => val < lowerBound || val > upperBound);
        const inliers = sorted.filter(val => val >= lowerBound && val <= upperBound);
        
        cohorts[complexity] = {
          complexity,
          data: inliers,
          outliers: outliers,
          size: n,
          stats: {
            min: Math.min(...data),
            q1: q1,
            median: median,
            q3: q3,
            max: Math.max(...data),
            mean: Math.round(mean * 10) / 10
          }
        };
      } else {
        cohorts[complexity] = {
          complexity,
          data: [],
          outliers: [],
          size: 0,
          stats: {
            min: 0,
            q1: 0,
            median: 0,
            q3: 0,
            max: 0,
            mean: 0
          }
        };
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        cohorts,
        timeType
      }
    });

  } catch (error) {
    console.error('Error fetching cycle time by complexity chart data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cycle time by complexity chart data' },
      { status: 500 }
    );
  }
}
