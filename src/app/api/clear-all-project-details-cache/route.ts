import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function POST() {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    // Clear all project details cache
    await dbService.clearProjectDetailsCache();

    return NextResponse.json({
      success: true,
      message: 'All project details cache cleared successfully'
    });

  } catch (error: any) {
    console.error('Error clearing all project details cache:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
