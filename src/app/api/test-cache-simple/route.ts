import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService, initializeDatabase } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing simple cache access...');
    
    // Try to initialize database first
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    const dbService = getDatabaseService();
    console.log('Database service obtained');
    
    // Try a simple count query
    const result = await dbService.getCycleTimeCache();
    console.log(`Cache query successful, found ${result.length} entries`);
    
    return NextResponse.json({
      success: true,
      message: 'Cache access test successful',
      data: {
        cacheCount: result.length,
        sampleEntries: result.slice(0, 3)
      }
    });
    
  } catch (error) {
    console.error('Error in cache test:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Cache access test failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
