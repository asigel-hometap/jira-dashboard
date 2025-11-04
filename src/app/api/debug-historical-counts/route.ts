import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';

/**
 * Debug endpoint to compare live counts vs historical counts
 */
export async function GET(request: NextRequest) {
  try {
    const member = request.nextUrl.searchParams.get('member') || 'Jacqueline Gallagher';
    const targetDateStr = request.nextUrl.searchParams.get('date') || '2025-09-15';
    const targetDate = new Date(targetDateStr);
    
    const dataProcessor = getDataProcessor();
    
    // Get live counts
    const liveBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMember(member);
    const liveCount = liveBreakdown.onTrack + liveBreakdown.atRisk + 
                     liveBreakdown.offTrack + liveBreakdown.onHold + 
                     liveBreakdown.mystery + liveBreakdown.complete + 
                     liveBreakdown.unknown;
    
    // Get historical counts
    const historicalBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMemberAtDate(member, targetDate);
    const historicalCount = historicalBreakdown.onTrack + historicalBreakdown.atRisk + 
                           historicalBreakdown.offTrack + historicalBreakdown.onHold + 
                           historicalBreakdown.mystery + historicalBreakdown.complete + 
                           historicalBreakdown.unknown;
    
    return NextResponse.json({
      success: true,
      member,
      targetDate: targetDateStr,
      live: {
        breakdown: liveBreakdown,
        total: liveCount
      },
      historical: {
        breakdown: historicalBreakdown,
        total: historicalCount
      },
      difference: liveCount - historicalCount
    });
    
  } catch (error) {
    console.error('Error in debug:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run debug',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

