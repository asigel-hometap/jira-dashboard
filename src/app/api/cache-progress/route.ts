import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService, initializeDatabase } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    const dbService = getDatabaseService();
    
    const cacheData = await dbService.getCycleTimeCache();
    
    // Get quarter distribution
    const quarterValues = cacheData.map(item => item.completionQuarter).filter(q => q);
    const quarterCounts = [...new Set(quarterValues)].map(quarter => ({
      quarter,
      count: quarterValues.filter(q => q === quarter).length
    })).sort((a, b) => a.quarter.localeCompare(b.quarter));
    
    // Get endDateLogic distribution
    const endDateLogicValues = cacheData.map(item => item.endDateLogic);
    const uniqueValues = [...new Set(endDateLogicValues)];
    const valueCounts = uniqueValues.map(value => ({
      value,
      count: endDateLogicValues.filter(v => v === value).length
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        totalCached: cacheData.length,
        quarterDistribution: quarterCounts,
        endDateLogicDistribution: valueCounts,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error getting cache progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get cache progress',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
