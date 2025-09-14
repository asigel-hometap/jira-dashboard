import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function POST(request: NextRequest) {
  try {
    console.log('Initializing database and loading data...');
    
    // Initialize database (Postgres or SQLite based on environment)
    await initializeDatabase();
    
    // Get data processor instance
    const dataProcessor = getDataProcessor();
    
    // Load historical capacity data
    await dataProcessor.loadCapacityData();
    
    // Process Jira data
    await dataProcessor.processJiraData();
    
    // Create initial snapshot
    await dataProcessor.createWeeklySnapshot();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database initialized and data loaded successfully' 
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
