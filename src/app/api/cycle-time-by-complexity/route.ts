import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    const { searchParams } = new URL(request.url);
    const timeType = searchParams.get('timeType') || 'calendar';

    // Get all completed discovery cycles from cache
    const cycleTimeCache = await dbService.getCycleTimeCache();
    
    // Get excluded issues
    const excludedIssues = await dbService.getExcludedIssues();
    
    // Filter for completed discovery cycles and group by complexity
    const complexityGroups: { [key: string]: number[] } = {
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
        const cycleTime = timeType === 'active' 
          ? (cached.activeDaysInDiscovery || 0)
          : (cached.calendarDaysInDiscovery || 0);
        
        if (cycleTime > 0) {
          // Ensure the complexity group exists, fallback to 'Not Set' if unknown
          const complexityKey = complexityGroups[discoveryComplexity] ? discoveryComplexity : 'Not Set';
          complexityGroups[complexityKey].push(cycleTime);
        }
      }
    }

    // Calculate statistics for each complexity group
    const complexityStats: { [key: string]: any } = {};
    
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
        
        complexityStats[complexity] = {
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
        complexityStats[complexity] = {
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
        complexityGroups: complexityStats,
        timeType: timeType
      }
    });

  } catch (error) {
    console.error('Error fetching cycle time by complexity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cycle time by complexity data' },
      { status: 500 }
    );
  }
}
