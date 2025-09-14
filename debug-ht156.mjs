import { getIssueChangelog } from './src/lib/jira-api.js';

async function debugHT156() {
  try {
    console.log('Fetching HT-156 changelog...');
    const changelog = await getIssueChangelog('HT-156');
    
    console.log('Changelog structure:', Object.keys(changelog));
    console.log('Histories length:', changelog.histories?.length || changelog.values?.length || 0);
    
    const histories = changelog.values || changelog.histories || [];
    console.log('\nFirst few history entries:');
    
    histories.slice(0, 5).forEach((history, i) => {
      console.log(`\nHistory ${i + 1}:`);
      console.log('  Date:', history.created);
      console.log('  Items:', history.items?.map(item => ({
        field: item.field,
        from: item.fromString,
        to: item.toString
      })));
    });
    
    // Look for discovery transitions
    console.log('\nLooking for discovery transitions...');
    const discoveryStatuses = ['02 Generative Discovery', '04 Problem Discovery', '05 Solution Discovery'];
    
    histories.forEach((history, i) => {
      if (history.items) {
        history.items.forEach(item => {
          if (item.field === 'status') {
            const from = item.fromString;
            const to = item.toString;
            const date = history.created;
            
            if (discoveryStatuses.includes(to) || discoveryStatuses.includes(from)) {
              console.log(`\nDiscovery transition at ${date}:`);
              console.log(`  From: ${from}`);
              console.log(`  To: ${to}`);
            }
          }
        });
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugHT156();
