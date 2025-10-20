import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting master sync...');
    const startTime = Date.now();
    
    const results = {
      daily: null,
      weekly: null,
      status: null,
      errors: [] as Array<{ step: string; error: string }>
    };
    
    // Run daily sync first
    try {
      console.log('Running daily sync...');
      const dailyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sync-daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      results.daily = await dailyResponse.json();
      console.log('Daily sync completed');
    } catch (error) {
      console.error('Daily sync failed:', error);
      results.errors.push({ step: 'daily', error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // Run weekly historical sync
    try {
      console.log('Running weekly historical sync...');
      const weeklyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sync-weekly-historical`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      results.weekly = await weeklyResponse.json();
      console.log('Weekly historical sync completed');
    } catch (error) {
      console.error('Weekly historical sync failed:', error);
      results.errors.push({ step: 'weekly', error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // Check final status
    try {
      console.log('Checking final sync status...');
      const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sync-status`);
      results.status = await statusResponse.json();
      console.log('Status check completed');
    } catch (error) {
      console.error('Status check failed:', error);
      results.errors.push({ step: 'status', error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    const duration = Date.now() - startTime;
    const success = results.errors.length === 0;
    
    console.log(`Master sync completed in ${duration}ms. Success: ${success}`);
    
    return NextResponse.json({
      success: success,
      message: success ? 'Master sync completed successfully' : 'Master sync completed with errors',
      data: {
        ...results,
        duration: duration,
        completedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in master sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
