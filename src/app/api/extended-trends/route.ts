import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function GET(request: NextRequest) {
  try {
    // Initialize database if not already done
    await initializeDatabase();
    
    const dataProcessor = getDataProcessor();
    
    // Get historical capacity data from CSV (starting from 2/10/2025)
    const capacityData = await getDatabaseService().getCapacityData();
    
    // Find the cutoff date (last historical data point)
    const lastHistoricalDate = capacityData.length > 0 
      ? capacityData[capacityData.length - 1].date 
      : new Date('2025-02-10');
    
    console.log(`Last historical data point: ${lastHistoricalDate.toISOString().split('T')[0]}`);
    
    // Get current date and calculate weeks needed
    const currentDate = new Date();
    const daysDiff = Math.floor((currentDate.getTime() - lastHistoricalDate.getTime()) / (24 * 60 * 60 * 1000));
    const weeksNeeded = Math.max(0, Math.floor(daysDiff / 7));
    
    console.log(`Days since last historical data: ${daysDiff}, Weeks of real-time data needed: ${weeksNeeded}`);
    
    // Generate real-time data for missing weeks (only completed weeks)
    const realTimeData = [];
    
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
        adam_active: 0,
        jennie_active: 0,
        jacqueline_active: 0,
        robert_active: 0,
        garima_active: 0,
        lizzy_active: 0,
        sanela_active: 0,
        total: 0,
        notes: 'Real-time Jira data',
        dataSource: 'realtime'
      };
      
      // Calculate workload for each team member AT THE SPECIFIC DATE
      for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
        try {
          // For the most recent week, use current data to ensure accuracy
          const isMostRecentWeek = weekOffset === weeksNeeded;
          const healthBreakdown = isMostRecentWeek 
            ? await dataProcessor.getActiveHealthBreakdownForTeamMember(fullName)
            : await dataProcessor.getActiveHealthBreakdownForTeamMemberAtDate(fullName, targetDate);
          
          // Total project count = sum of all health values (including complete and unknown)
          const totalProjectCount = healthBreakdown.onTrack + healthBreakdown.atRisk + 
                                   healthBreakdown.offTrack + healthBreakdown.onHold + 
                                   healthBreakdown.mystery + healthBreakdown.complete + 
                                   healthBreakdown.unknown;
          
          // Active projects = total (all health values included)
          const activeProjectCount = totalProjectCount;
          
          weekData[shortName] = totalProjectCount;
          weekData[`${shortName}_active`] = activeProjectCount;
          weekData.total += totalProjectCount;
        } catch (error) {
          console.warn(`Error calculating workload for ${fullName} at ${targetDate.toISOString()}:`, error);
          weekData[shortName] = 0;
          weekData[`${shortName}_active`] = 0;
        }
      }
      
      realTimeData.push(weekData);
    }
    
    // Combine historical and real-time data
    const allData = [...capacityData, ...realTimeData];
    
    // Sort by date to ensure proper order
    allData.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // For the most recent week, use live Jira data to ensure accuracy
    // For historical weeks, use stored capacity data
    console.log(`Using stored capacity data for ${allData.length} weeks`);
    
    // Update the most recent week with live data if it exists
    if (allData.length > 0) {
      const mostRecentWeek = allData[allData.length - 1];
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      // Only update if the most recent data is from today or yesterday (very recent)
      if (mostRecentWeek.date >= yesterday) {
        console.log(`Updating most recent week (${mostRecentWeek.date.toISOString().split('T')[0]}) with live Jira data`);
        
        // Calculate live data for the most recent week
        for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
          try {
            const healthBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMember(fullName);
            
            // Total project count = sum of all health values (including complete and unknown)
            const totalProjectCount = healthBreakdown.onTrack + healthBreakdown.atRisk + 
                                     healthBreakdown.offTrack + healthBreakdown.onHold + 
                                     healthBreakdown.mystery + healthBreakdown.complete + 
                                     healthBreakdown.unknown;
            
            // Active projects = total (all health values included)
            const activeProjectCount = totalProjectCount;
            
            mostRecentWeek[shortName] = totalProjectCount;
            mostRecentWeek[`${shortName}_active`] = activeProjectCount;
          } catch (error) {
            console.warn(`Error updating live data for ${fullName}:`, error);
          }
        }
        
        // Recalculate total
        mostRecentWeek.total = Object.values(teamMemberMap).reduce((sum, shortName) => 
          sum + (mostRecentWeek[shortName] || 0), 0);
        mostRecentWeek.notes = 'Live Jira data (updated)';
        mostRecentWeek.dataSource = 'live-updated';
      }
    }
    
    // Transform data for sparklines
    const trendsData = {
      // Total projects (including complete)
      adam: allData.map(d => d.adam || 0),
      jennie: allData.map(d => d.jennie || 0),
      jacqueline: allData.map(d => d.jacqueline || 0),
      robert: allData.map(d => d.robert || 0),
      garima: allData.map(d => d.garima || 0),
      lizzy: allData.map(d => d.lizzy || 0),
      sanela: allData.map(d => d.sanela || 0),
      // Active projects (excluding complete) - for historical data, assume same as total
      adam_active: allData.map(d => d.adam_active || d.adam || 0),
      jennie_active: allData.map(d => d.jennie_active || d.jennie || 0),
      jacqueline_active: allData.map(d => d.jacqueline_active || d.jacqueline || 0),
      robert_active: allData.map(d => d.robert_active || d.robert || 0),
      garima_active: allData.map(d => d.garima_active || d.garima || 0),
      lizzy_active: allData.map(d => d.lizzy_active || d.lizzy || 0),
      sanela_active: allData.map(d => d.sanela_active || d.sanela || 0),
      dates: allData.map(d => d.date.toISOString().split('T')[0]),
      total: allData.map(d => d.total || 0),
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
    
    // Return mock data when database is unavailable
    const mockData = {
      adam: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      jennie: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
      jacqueline: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
      robert: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
      garima: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      lizzy: [7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
      sanela: [7, 7, 7, 7, 7, 7, 7, 7, 8, 8],
      adam_active: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      jennie_active: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
      jacqueline_active: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
      robert_active: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
      garima_active: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      lizzy_active: [7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
      sanela_active: [7, 7, 7, 7, 7, 7, 7, 7, 8, 8],
      dates: ['2025-08-11', '2025-08-18', '2025-08-25', '2025-09-01', '2025-09-08', '2025-09-15', '2025-09-22', '2025-09-29', '2025-10-06', '2025-10-13'],
      total: [40, 40, 40, 40, 40, 40, 40, 40, 40, 40],
      historicalDataPoints: 0,
      realTimeDataPoints: 10,
      totalDataPoints: 10
    };
    
    return NextResponse.json({
      success: true,
      data: mockData,
      warning: 'Database unavailable, using mock data'
    });
  }
}
