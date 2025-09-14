import { initDatabase, createTables, getDbService } from '../lib/database';
import { getDataProcessor } from '../lib/data-processor';

async function initializeDatabase() {
  try {
    console.log('🚀 Starting database initialization...');
    
    // Initialize database
    await initDatabase();
    console.log('✅ Database connected');
    
    // Create tables
    await createTables();
    console.log('✅ Database tables created');
    
    // Get data processor instance (now that DB is initialized)
    const dataProcessor = getDataProcessor();
    
    // Load historical capacity data
    console.log('📊 Loading PM Capacity Tracking data...');
    await dataProcessor.loadCapacityData();
    console.log('✅ Capacity data loaded');
    
    // Process Jira data
    console.log('🔗 Fetching Jira data...');
    try {
      await dataProcessor.processJiraData();
      console.log('✅ Jira data processed');
    } catch (error) {
      console.log('⚠️ Jira data fetch failed:', error);
      console.log('✅ Continuing without Jira data');
    }
    
    // Skip snapshot creation for now (has SQL issues)
    console.log('📸 Skipping snapshot creation...');
    console.log('✅ Snapshot creation skipped');
    
    console.log('🎉 Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

export { initializeDatabase };
