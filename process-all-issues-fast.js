#!/usr/bin/env node

/**
 * Fast script to process all 519 Jira issues
 * Processes 5 issues per minute (12 seconds each)
 * Run with: node process-all-issues-fast.js
 */

const BASE_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllIssueKeys() {
  console.log('Fetching all issue keys...');
  const response = await fetch(`${BASE_URL}/api/get-all-issue-keys`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to fetch issue keys: ${data.error}`);
  }
  
  console.log(`Found ${data.data.totalIssues} issues to process`);
  return data.data.issueKeys;
}

async function processIssue(issueKey) {
  try {
    const response = await fetch(`${BASE_URL}/api/process-single-issue?issueKey=${issueKey}`, {
      method: 'POST'
    });
    const data = await response.json();
    
    if (data.success) {
      if (data.data.cached) {
        return { success: true, cached: true, status: 'cached' };
      } else {
        return { success: true, cached: false, status: data.data.cycleInfo.endDateLogic };
      }
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getCacheStatus() {
  try {
    const response = await fetch(`${BASE_URL}/api/cache-progress`);
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('🚀 Starting FAST processing of all Jira issues...');
  console.log('⏱️  Processing 5 issues per 2.5 minutes (30 seconds between batches)\n');
  
  const issueKeys = await fetchAllIssueKeys();
  const initialStatus = await getCacheStatus();
  console.log(`Initial cache: ${initialStatus?.totalCached || 0} issues\n`);
  
  let processed = 0;
  let cached = 0;
  let errors = 0;
  const startTime = Date.now();
  
  // Process in batches of 5
  for (let i = 0; i < issueKeys.length; i += 5) {
    const batch = issueKeys.slice(i, i + 5);
    const batchNumber = Math.floor(i / 5) + 1;
    const totalBatches = Math.ceil(issueKeys.length / 5);
    
    console.log(`📦 Batch ${batchNumber}/${totalBatches} (${batch.length} issues):`);
    
    // Process batch concurrently
    const promises = batch.map(issue => processIssue(issue.key));
    const results = await Promise.all(promises);
    
    // Process results
    results.forEach((result, index) => {
      const issue = batch[index];
      if (result.success) {
        processed++;
        if (result.cached) {
          cached++;
          console.log(`  ✓ ${issue.key} - Cached`);
        } else {
          console.log(`  ✓ ${issue.key} - ${result.status}`);
        }
      } else {
        errors++;
        console.log(`  ✗ ${issue.key} - ${result.error}`);
      }
    });
    
    // Progress update
    const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
    const remaining = Math.round((issueKeys.length - processed - cached) / 5);
    console.log(`  📊 Processed: ${processed}, Cached: ${cached}, Errors: ${errors}, ETA: ${remaining}min\n`);
    
    // Wait 15 seconds between batches (except for the last batch)
    if (i + 5 < issueKeys.length) {
      console.log(`⏳ Waiting 15 seconds before next batch...\n`);
      await sleep(15000);
    }
  }
  
  // Final status
  const finalStatus = await getCacheStatus();
  const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);
  
  console.log('🎉 Processing complete!');
  console.log(`⏱️  Total time: ${totalTime} minutes`);
  console.log(`📊 Final Results:`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Already cached: ${cached}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total in cache: ${finalStatus?.totalCached || 0}`);
  console.log(`   Discovery cycles: ${finalStatus?.endDateLogicDistribution?.find(d => d.value === 'Build Transition')?.count || 0}`);
  
  if (finalStatus?.quarterDistribution) {
    console.log(`\n📅 Quarter Distribution:`);
    finalStatus.quarterDistribution.forEach(q => {
      console.log(`   ${q.quarter}: ${q.count} projects`);
    });
  }
}

process.on('SIGINT', () => {
  console.log('\n\n⚠️  Processing interrupted. Cache data is preserved.');
  process.exit(0);
});

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
