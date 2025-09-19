import { NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres-database';

export async function POST() {
  try {
    const client = await getPostgresPool().connect();
    
    try {
      // Add discovery_complexity columns to project_details_cache table
      await client.query(`
        ALTER TABLE project_details_cache 
        ADD COLUMN IF NOT EXISTS discovery_complexity VARCHAR(255),
        ADD COLUMN IF NOT EXISTS discovery_complexity_id VARCHAR(255)
      `);

      // Add index for discovery_complexity for better query performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_project_details_cache_discovery_complexity 
        ON project_details_cache(discovery_complexity)
      `);

      return NextResponse.json({ 
        success: true, 
        message: 'Successfully added discovery_complexity columns to project_details_cache table' 
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error adding discovery_complexity columns to project_details_cache:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to add discovery_complexity columns to project_details_cache' 
    }, { status: 500 });
  }
}
