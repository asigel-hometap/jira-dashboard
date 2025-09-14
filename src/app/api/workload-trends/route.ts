import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    // Initialize database if not already done
    await initializeDatabase();
    
    // Get all capacity data
    const capacityData = await getDatabaseService().getCapacityData();
    
    // Transform data for sparklines
    const trendsData = {
      adam: capacityData.map(d => d.adam),
      jennie: capacityData.map(d => d.jennie),
      jacqueline: capacityData.map(d => d.jacqueline),
      robert: capacityData.map(d => d.robert),
      garima: capacityData.map(d => d.garima),
      lizzy: capacityData.map(d => d.lizzy),
      sanela: capacityData.map(d => d.sanela),
      dates: capacityData.map(d => d.date.toISOString().split('T')[0])
    };
    
    return NextResponse.json({ 
      success: true, 
      data: trendsData 
    });
  } catch (error) {
    console.error('Error fetching workload trends:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
