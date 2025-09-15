import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function POST(request: Request) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');

    if (quarter) {
      // Clear specific quarter
      const client = await (dbService as any).pool.connect();
      try {
        await client.query('DELETE FROM project_details_cache WHERE quarter = $1', [quarter]);
        console.log(`Cleared project details cache for ${quarter}`);
        return NextResponse.json({ 
          success: true, 
          message: `Project details cache cleared for ${quarter}` 
        });
      } finally {
        client.release();
      }
    } else {
      // Clear all project details cache
      await dbService.clearProjectDetailsCache();
      console.log('Cleared all project details cache');
      return NextResponse.json({ 
        success: true, 
        message: 'All project details cache cleared' 
      });
    }

  } catch (error: any) {
    console.error('Error clearing project details cache:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
