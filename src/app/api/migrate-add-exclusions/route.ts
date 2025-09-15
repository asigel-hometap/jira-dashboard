import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres-database';

export async function POST(request: NextRequest) {
  try {
    const pool = getPostgresPool();
    const client = await pool.connect();
    
    try {
      // Add project exclusions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS project_exclusions (
          id SERIAL PRIMARY KEY,
          issue_key VARCHAR(255) NOT NULL UNIQUE,
          excluded_by VARCHAR(255) NOT NULL,
          exclusion_reason TEXT,
          excluded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      return NextResponse.json({
        success: true,
        message: 'Project exclusions table created successfully'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating project exclusions table:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
