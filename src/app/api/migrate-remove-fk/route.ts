import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres-database';

export async function POST(request: NextRequest) {
  try {
    const pool = getPostgresPool();
    const client = await pool.connect();
    
    console.log('Removing foreign key constraints...');
    
    // Drop foreign key constraints
    await client.query(`
      ALTER TABLE cycle_time_cache 
      DROP CONSTRAINT IF EXISTS cycle_time_cache_issue_key_fkey;
    `);
    
    await client.query(`
      ALTER TABLE project_details_cache 
      DROP CONSTRAINT IF EXISTS project_details_cache_issue_key_fkey;
    `);
    
    await client.query(`
      ALTER TABLE status_transitions 
      DROP CONSTRAINT IF EXISTS status_transitions_issue_key_fkey;
    `);
    
    await client.query(`
      ALTER TABLE health_transitions 
      DROP CONSTRAINT IF EXISTS health_transitions_issue_key_fkey;
    `);
    
    console.log('Foreign key constraints removed successfully');
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: 'Foreign key constraints removed successfully'
    });
    
  } catch (error) {
    console.error('Error removing foreign key constraints:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove foreign key constraints',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
