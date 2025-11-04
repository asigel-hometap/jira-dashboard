# Team Workload Diagnostic Plan

## Current Issues

1. **Browser Error**: "No weekly snapshot found. Please create a snapshot first."
2. **Server Errors**: Connection refused when fetching `/api/extended-trends`

## Step-by-Step Investigation Plan

### Step 1: Check What Data Currently Exists

**Action**: Call the diagnostic endpoint
```
GET /api/debug-capacity-data
```

**Questions to answer**:
- Does the `capacity_data` table have any entries?
- If yes, what dates are they for?
- What are the project counts in the most recent snapshot?
- When was the last snapshot created?

### Step 2: Understand Current Data Sources

**Questions**:
- Does the CSV file (`PM Capacity Tracking.csv`) have data that should be loaded into `capacity_data`?
- What is the relationship between the CSV and the `capacity_data` table?
- Should we load CSV data first, or start fresh with new snapshots?

### Step 3: Verify Snapshot Creation Logic

**Action**: Test the snapshot creation endpoint manually
```
POST /api/create-weekly-snapshot
```

**Questions to answer**:
- Does it successfully fetch data from Jira?
- Does it correctly filter active projects?
- Does it successfully save to `capacity_data`?
- What counts does it generate for each team member?

### Step 4: Validate the Counting Logic

**Before implementing**, we need to agree on:

1. **What counts as an "active project"?**
   - Current logic: `health !== 'Complete' AND status in (Generative Discovery, Problem Discovery, Solution Discovery, Build, Beta) AND not archived`
   - Is this correct?

2. **What date should the snapshot represent?**
   - Current logic: Start of current week (Sunday)
   - Should it be start of week, or a specific day/time?

3. **How should we handle edge cases?**
   - What if a team member has no projects assigned?
   - What if a project changes assignee mid-week?
   - What if a project is archived after the snapshot?

### Step 5: Fix the Extended-Trends Connection Issue

The `accurate-sparkline` endpoint is trying to fetch from `/api/extended-trends` but getting connection refused.

**Questions**:
- Is `/api/extended-trends` supposed to be available?
- Is it an internal fetch issue (should use relative URL instead)?
- Can we make sparkline work independently for now?

## Next Actions

1. **Run diagnostic**: `/api/debug-capacity-data`
2. **Review CSV data**: Check what's in `PM Capacity Tracking.csv`
3. **Test snapshot creation**: Manually create one snapshot and verify the data
4. **Validate counting**: Compare manual count with snapshot count for one team member
5. **Fix sparkline errors**: Address the connection issue separately

## Questions for User

1. Should we load the CSV data into `capacity_data` first, or start fresh with new snapshots?
2. What exactly should count as an "active project" for the weekly snapshot?
3. Should the snapshot represent the state at the start of the week, or can it be created anytime?
4. Should we fix the sparkline errors now, or focus on the workload counting first?

