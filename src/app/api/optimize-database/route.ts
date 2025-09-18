import { NextRequest } from 'next/server';
import { initializeDatabase } from '@/lib/database-factory';
import { handleApiError, createSuccessResponse } from '@/lib/error-handler';
import { ALL_INDEXES, PRIORITY_INDEXES, PERFORMANCE_QUERIES } from '@/lib/database-indexes';
import { getPostgresPool } from '@/lib/postgres-database';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'priority'; // 'priority', 'all', or 'check'
    
    if (mode === 'check') {
      // Check current performance
      const client = await getPostgresPool().connect();
      try {
        const indexUsage = await client.query(PERFORMANCE_QUERIES.checkIndexUsage);
        const tableSizes = await client.query(PERFORMANCE_QUERIES.checkTableSizes);
        
        return createSuccessResponse({
          indexUsage: indexUsage.rows,
          tableSizes: tableSizes.rows,
          message: 'Performance check completed'
        });
      } finally {
        client.release();
      }
    }
    
    const indexesToCreate = mode === 'all' ? ALL_INDEXES : PRIORITY_INDEXES;
    const results = [];
    
    console.log(`Creating ${indexesToCreate.length} database indexes in ${mode} mode...`);
    
    for (const indexQuery of indexesToCreate) {
      try {
        await getPostgresPool().query(indexQuery);
        const indexName = indexQuery.match(/CREATE INDEX.*?ON\s+(\w+)/)?.[1] || 'unknown';
        results.push({ index: indexName, status: 'created' });
        console.log(`✅ Created index: ${indexName}`);
      } catch (error) {
        const indexName = indexQuery.match(/CREATE INDEX.*?ON\s+(\w+)/)?.[1] || 'unknown';
        results.push({ index: indexName, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
        console.error(`❌ Failed to create index: ${indexName}`, error);
      }
    }
    
    const successCount = results.filter(r => r.status === 'created').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    return createSuccessResponse({
      message: `Database optimization completed: ${successCount} indexes created, ${errorCount} errors`,
      results,
      summary: {
        total: indexesToCreate.length,
        created: successCount,
        errors: errorCount
      }
    });
    
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    
    // Check current performance
    const client = await getPostgresPool().connect();
    try {
      const indexUsage = await client.query(PERFORMANCE_QUERIES.checkIndexUsage);
      const tableSizes = await client.query(PERFORMANCE_QUERIES.checkTableSizes);
      
      return createSuccessResponse({
        indexUsage: indexUsage.rows,
        tableSizes: tableSizes.rows,
        message: 'Current database performance metrics'
      });
    } finally {
      client.release();
    }
    
  } catch (error) {
    return handleApiError(error);
  }
}
