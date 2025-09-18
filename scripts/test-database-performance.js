#!/usr/bin/env node

/**
 * Database Performance Test Script
 * 
 * This script tests the database performance before and after optimization.
 * Run this to measure the impact of the new indexes.
 */

const { performance } = require('perf_hooks');

async function testDatabasePerformance() {
  console.log('🚀 Testing Database Performance...\n');
  
  try {
    // Test 1: Check current performance
    console.log('📊 Checking current database performance...');
    const checkResponse = await fetch('http://localhost:3001/api/optimize-database');
    const checkData = await checkResponse.json();
    
    if (checkData.success) {
      console.log('✅ Current performance metrics:');
      console.log(`   - Indexes in use: ${checkData.indexUsage.length}`);
      console.log(`   - Tables: ${checkData.tableSizes.length}`);
      
      // Show most used indexes
      const topIndexes = checkData.indexUsage
        .filter(idx => idx.idx_scan > 0)
        .sort((a, b) => b.idx_scan - a.idx_scan)
        .slice(0, 5);
      
      if (topIndexes.length > 0) {
        console.log('\n📈 Most used indexes:');
        topIndexes.forEach(idx => {
          console.log(`   - ${idx.indexname}: ${idx.idx_scan} scans`);
        });
      }
    }
    
    // Test 2: Apply priority indexes
    console.log('\n🔧 Applying priority database indexes...');
    const optimizeResponse = await fetch('http://localhost:3001/api/optimize-database?mode=priority', {
      method: 'POST'
    });
    const optimizeData = await optimizeResponse.json();
    
    if (optimizeData.success) {
      console.log('✅ Database optimization completed:');
      console.log(`   - Indexes created: ${optimizeData.summary.created}`);
      console.log(`   - Errors: ${optimizeData.summary.errors}`);
      
      if (optimizeData.summary.errors > 0) {
        console.log('\n❌ Errors encountered:');
        optimizeData.results
          .filter(r => r.status === 'error')
          .forEach(r => {
            console.log(`   - ${r.index}: ${r.error}`);
          });
      }
    }
    
    // Test 3: Measure API response times
    console.log('\n⏱️  Measuring API response times...');
    
    const apis = [
      { name: 'Workload', url: '/api/workload' },
      { name: 'Trends', url: '/api/trends' },
      { name: 'Projects at Risk', url: '/api/projects-at-risk' },
      { name: 'Cycle Time Analysis', url: '/api/cycle-time-analysis' },
      { name: 'Data Context', url: '/api/data-context' }
    ];
    
    for (const api of apis) {
      const start = performance.now();
      try {
        const response = await fetch(`http://localhost:3001${api.url}`);
        const end = performance.now();
        const duration = Math.round(end - start);
        
        if (response.ok) {
          console.log(`   ✅ ${api.name}: ${duration}ms`);
        } else {
          console.log(`   ❌ ${api.name}: ${duration}ms (HTTP ${response.status})`);
        }
      } catch (error) {
        console.log(`   ❌ ${api.name}: Error - ${error.message}`);
      }
    }
    
    console.log('\n🎉 Database performance test completed!');
    
  } catch (error) {
    console.error('❌ Error running performance test:', error.message);
    process.exit(1);
  }
}

// Run the test
testDatabasePerformance();
