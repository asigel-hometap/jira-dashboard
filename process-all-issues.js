#!/usr/bin/env node

/**
 * Script to process all 519 Jira issues systematically
 * Processes 1 issue per minute to avoid timeouts
 * Run with: node process-all-issues.js
 */

const BASE_URL = 'http://localhost:3000';
const fs = require('fs');
const path = require('path');

// Create logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Logging functions
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  const logFile = path.join(logsDir, `processing-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage);
}

function log(message) {
  console.log(message);
  logToFile(message);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllIssueKeys() {
  log('Fetching all issue keys...');
  const response = await fetch(`${BASE_URL}/api/get-all-issue-keys`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to fetch issue keys: ${data.error}`);
  }
  
  log(`Found ${data.data.totalIssues} issues to process`);
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
        log(`✓ ${issueKey} - Already cached`);
      } else {
        log(`✓ ${issueKey} - Processed: ${data.data.cycleInfo.endDateLogic}`);
      }
      return { success: true, cached: data.data.cached };
    } else {
      log(`✗ ${issueKey} - Error: ${data.error}`);
      return { success: false, error: data.error };
    }
  } catch (error) {
    log(`✗ ${issueKey} - Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function getCacheStatus() {
  try {
    const response = await fetch(`${BASE_URL}/api/processing-status-cached`);
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    log('Could not fetch cache status:', error.message);
    return null;
  }
}

async function main() {
  log('🚀 Starting systematic processing of all Jira issues...\n');
  
  // Get all issue keys
  const issueKeys = await fetchAllIssueKeys();
  
  // Get initial cache status
  const initialStatus = await getCacheStatus();
  log(`Initial cache status: ${initialStatus?.progress?.cachedCount || 0} issues cached`);
  log(`Uncached issues: ${initialStatus?.progress?.uncachedCount || 0}`);
  log(`Progress: ${initialStatus?.progress?.progressPercentage || 0}%\n`);
  
  let processed = 0;
  let cached = 0;
  let errors = 0;
  const startTime = Date.now();
  
  // Process each issue with 1-minute intervals
  for (let i = 0; i < issueKeys.length; i++) {
    const issue = issueKeys[i];
    const progress = `[${i + 1}/${issueKeys.length}]`;
    
    log(`${progress} Processing ${issue.key} (${issue.status})...`);
    
    const result = await processIssue(issue.key);
    
    if (result.success) {
      processed++;
      if (result.cached) {
        cached++;
      }
    } else {
      errors++;
    }
    
    // Show progress every 10 issues
    if ((i + 1) % 10 === 0) {
      const status = await getCacheStatus();
      const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
            const remaining = Math.round((issueKeys.length - i - 1) / 4); // 4 per minute (15 seconds each)
      
      log(`\n📊 Progress Update:`);
      log(`   Processed: ${processed}`);
      log(`   Already cached: ${cached}`);
      log(`   Errors: ${errors}`);
      log(`   Total in cache: ${status?.progress?.cachedCount || 0}`);
      log(`   Progress: ${status?.progress?.progressPercentage || 0}%`);
      log(`   Elapsed: ${elapsed} minutes`);
      log(`   ETA: ${remaining} minutes`);
      log(`   Discovery cycles: ${status?.statusDistribution?.find(d => d.value === 'Build Transition')?.count || 0}\n`);
    }
    
          // Wait 15 seconds before next issue (except for the last one)
          if (i < issueKeys.length - 1) {
            log(`⏳ Waiting 15 seconds before next issue...\n`);
            await sleep(15000); // 15 seconds
          }
  }
  
  // Final status
  const finalStatus = await getCacheStatus();
  const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);
  
  log('\n🎉 Processing complete!');
  log(`⏱️  Total time: ${totalTime} minutes`);
  log(`📊 Final Results:`);
  log(`   Total processed: ${processed}`);
  log(`   Already cached: ${cached}`);
  log(`   Errors: ${errors}`);
  log(`   Total in cache: ${finalStatus?.progress?.cachedCount || 0}`);
  log(`   Discovery cycles: ${finalStatus?.statusDistribution?.find(d => d.value === 'Build Transition')?.count || 0}`);
  
  if (finalStatus?.quarterDistribution) {
    log(`\n📅 Quarter Distribution:`);
    finalStatus.quarterDistribution.forEach(q => {
      log(`   ${q.quarter}: ${q.count} projects`);
    });
  }
  
  // Save final report
  const reportFile = path.join(logsDir, `final-report-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(reportFile, JSON.stringify({
    completedAt: new Date().toISOString(),
    totalTime: totalTime,
    processed,
    cached,
    errors,
    finalStatus
  }, null, 2));
  
  log(`\n📄 Final report saved to: ${reportFile}`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Processing interrupted by user. Cache data is preserved.');
  process.exit(0);
});

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
