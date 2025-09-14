import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function POST(request: NextRequest) {
  try {
    // Initialize database first
    await initializeDatabase();
    const dbService = getDatabaseService();
    await dbService.clearCycleTimeCache();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cycle time cache cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { success: false, error: `Failed to clear cache: ${error}` },
      { status: 500 }
    );
  }
}
