import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, getDbService } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    // Initialize database first
    await initDatabase();
    const dbService = getDbService();
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
