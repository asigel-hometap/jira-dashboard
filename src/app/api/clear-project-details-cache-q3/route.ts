import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Clear project details cache for Q3_2025
    await dbService.clearProjectDetailsCacheByQuarter('Q3_2025');
    console.log('Cleared project details cache for Q3_2025');
    
    return NextResponse.json({
      success: true,
      message: 'Project details cache cleared for Q3_2025'
    });
    
  } catch (error) {
    console.error('Error clearing project details cache:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear project details cache' },
      { status: 500 }
    );
  }
}
