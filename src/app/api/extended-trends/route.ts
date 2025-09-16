import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function GET(request: NextRequest) {
  try {
    // Initialize database if not already done
    await initializeDatabase();
    
    // Get historical capacity data
    const capacityData = await getDatabaseService().getCapacityData();
    
    // Find the cutoff date (last historical data point)
    const lastHistoricalDate = capacityData.length > 0 
      ? capacityData[capacityData.length - 1].date 
      : new Date('2025-09-08');
    
    console.log(`Last historical data point: ${lastHistoricalDate.toISOString().split('T')[0]}`);
    
    // Get current date and calculate weeks needed
    const currentDate = new Date();
    const daysDiff = Math.floor((currentDate.getTime() - lastHistoricalDate.getTime()) / (24 * 60 * 60 * 1000));
    const weeksNeeded = Math.max(0, Math.floor(daysDiff / 7));
    
    console.log(`Days since last historical data: ${daysDiff}, Weeks of real-time data needed: ${weeksNeeded}`);
    
    // Generate real-time data for missing weeks
    const realTimeData = [];
    const dataProcessor = getDataProcessor();
    
    // Team member mapping
    const teamMemberMap = {
      'Adam Sigel': 'adam',
      'Jennie Goldenberg': 'jennie', 
      'Jacqueline Gallagher': 'jacqueline',
      'Robert J. Johnson': 'robert',
      'Garima Giri': 'garima',
      'Lizzy Magill': 'lizzy',
      'Sanela Smaka': 'sanela'
    };
    
    // Calculate real-time data for each missing week (only completed weeks)
    for (let weekOffset = 1; weekOffset <= weeksNeeded; weekOffset++) {
      const targetDate = new Date(lastHistoricalDate);
      targetDate.setDate(targetDate.getDate() + (weekOffset * 7));
      
      // Only generate data for weeks that have passed
      if (targetDate <= currentDate) {
        console.log(`Calculating real-time data for week of ${targetDate.toISOString().split('T')[0]}`);
      } else {
        console.log(`Skipping future week: ${targetDate.toISOString().split('T')[0]}`);
        continue;
      }
      
      // Get current workload for each team member
      const weekData: any = {
        date: targetDate,
        adam: 0,
        jennie: 0,
        jacqueline: 0,
        robert: 0,
        garima: 0,
        lizzy: 0,
        sanela: 0,
        total: 0,
        notes: 'Real-time Jira data',
        dataSource: 'realtime'
      };
      
      // Calculate workload for each team member
      for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
        try {
          const healthBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMember(fullName);
          const activeProjectCount = healthBreakdown.onTrack + healthBreakdown.atRisk + 
                                   healthBreakdown.offTrack + healthBreakdown.onHold + 
                                   healthBreakdown.mystery + healthBreakdown.complete + 
                                   healthBreakdown.unknown;
          
          weekData[shortName] = activeProjectCount;
          weekData.total += activeProjectCount;
        } catch (error) {
          console.warn(`Error calculating workload for ${fullName}:`, error);
          weekData[shortName] = 0;
        }
      }
      
      realTimeData.push(weekData);
    }
    
    // Combine historical and real-time data
    const allData = [...capacityData, ...realTimeData];
    
    // Sort by date to ensure proper order
    allData.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Transform data for sparklines
    const trendsData = {
      adam: allData.map(d => d.adam),
      jennie: allData.map(d => d.jennie),
      jacqueline: allData.map(d => d.jacqueline),
      robert: allData.map(d => d.robert),
      garima: allData.map(d => d.garima),
      lizzy: allData.map(d => d.lizzy),
      sanela: allData.map(d => d.sanela),
      dates: allData.map(d => d.date.toISOString().split('T')[0]),
      dataSource: allData.map(d => d.dataSource || 'historical'),
      totalDataPoints: allData.length,
      historicalDataPoints: capacityData.length,
      realTimeDataPoints: realTimeData.length
    };
    
    console.log(`Extended trends data: ${trendsData.historicalDataPoints} historical + ${trendsData.realTimeDataPoints} real-time = ${trendsData.totalDataPoints} total`);
    
    return NextResponse.json({ 
      success: true, 
      data: trendsData 
    });
  } catch (error) {
    console.error('Error fetching extended trends:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
