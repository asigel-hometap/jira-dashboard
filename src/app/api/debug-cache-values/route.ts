import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService, initializeDatabase } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    const cacheData = await dbService.getCycleTimeCache();
    
    // Get all endDateLogic values
    const endDateLogicValues = cacheData.map(item => item.endDateLogic);
    const uniqueValues = [...new Set(endDateLogicValues)];
    
    // Count each value
    const valueCounts = uniqueValues.map(value => ({
      value,
      count: endDateLogicValues.filter(v => v === value).length
    }));
    
    // Get quarter distribution
    const quarterValues = cacheData.map(item => item.completionQuarter).filter(q => q);
    const quarterCounts = [...new Set(quarterValues)].map(quarter => ({
      quarter,
      count: quarterValues.filter(q => q === quarter).length
    }));
    
    // Get sample projects for each endDateLogic value
    const samples = uniqueValues.map(value => {
      const sample = cacheData.find(item => item.endDateLogic === value);
      return {
        value,
        sample: sample ? {
          issueKey: sample.issueKey,
          discoveryStartDate: sample.discoveryStartDate,
          discoveryEndDate: sample.discoveryEndDate,
          completionQuarter: sample.completionQuarter
        } : null
      };
    });
    
    return NextResponse.json({
      success: true,
      data: {
        totalCached: cacheData.length,
        endDateLogicValues: valueCounts,
        quarterDistribution: quarterCounts,
        samples
      }
    });
  } catch (error) {
    console.error('Error debugging cache values:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to debug cache values',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
