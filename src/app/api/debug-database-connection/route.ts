import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Check database connection
    const connectionInfo = {
      environment: process.env.NODE_ENV,
      postgresUrl: process.env.POSTGRES_URL ? 'Set' : 'Not set',
      databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set',
      usePostgres: process.env.USE_POSTGRES,
    };
    
    // Get cycle time cache count
    const cycleTimeCache = await dbService.getCycleTimeCache();
    const cacheCount = cycleTimeCache.length;
    
    // Get a sample of cached data
    const sampleData = cycleTimeCache.slice(0, 5).map(item => ({
      issueKey: item.issueKey,
      completionQuarter: item.completionQuarter,
      calendarDaysInDiscovery: item.calendarDaysInDiscovery,
      activeDaysInDiscovery: item.activeDaysInDiscovery,
      endDateLogic: item.endDateLogic,
      calculatedAt: item.calculatedAt
    }));
    
    // Count by quarter
    const quarterCounts = cycleTimeCache.reduce((acc: any, item: any) => {
      const quarter = item.completionQuarter;
      if (quarter) {
        acc[quarter] = (acc[quarter] || 0) + 1;
      }
      return acc;
    }, {});
    
    return NextResponse.json({
      success: true,
      connectionInfo,
      cacheInfo: {
        totalCachedItems: cacheCount,
        quarterCounts,
        sampleData
      }
    });
  } catch (error) {
    console.error('Error checking database connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionInfo: {
          environment: process.env.NODE_ENV,
          postgresUrl: process.env.POSTGRES_URL ? 'Set' : 'Not set',
          databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set',
          usePostgres: process.env.USE_POSTGRES,
        }
      },
      { status: 500 }
    );
  }
}
