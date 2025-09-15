import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService, initializeDatabase } from '@/lib/database-factory';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    console.log('Clearing cycle time cache...');
    
    await dbService.clearCycleTimeCache();
    
    console.log('Cycle time cache cleared successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Cycle time cache cleared successfully'
    });
    
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}