# Verification Plan for Project Counting

## Goal
Ensure we can reliably:
1. Assess projects for the current week (matches Jira)
2. Store snapshots correctly
3. Assess projects for historical weeks (matches what was in Jira at that time)

## Step 1: Verify Current Week Assessment

### Test: Compare API output with Jira
**Endpoint**: `/api/debug-current-projects?member=Jacqueline%20Gallagher`

**What to verify**:
- ✅ Total project count matches Jira
- ✅ Health breakdown matches Jira
- ✅ Each project in the list exists in Jira with the same status/health
- ✅ No projects are missing that should be included
- ✅ No projects are included that should be excluded

**Filtering criteria to verify**:
- Status must be: Generative Discovery, Problem Discovery, Solution Discovery, Build, or Beta
- Must NOT be archived (isArchived = false AND archivedOn = null)
- All health values included (Complete, unknown, etc.)

## Step 2: Verify Snapshot Creation

### Test: Create snapshot and verify it stores correctly
**Endpoint**: `POST /api/create-weekly-snapshot`

**What to verify**:
- ✅ Snapshot is created for the correct week start date (Sunday)
- ✅ Counts stored match the current week assessment
- ✅ Snapshot is stored in `capacity_data` table
- ✅ Can retrieve the snapshot immediately after creation

### Test: Compare snapshot with live data
After creating snapshot:
1. Get live data: `/api/debug-current-projects?member=Jacqueline%20Gallagher`
2. Get snapshot data: `/api/debug-workload-weekly` (check the snapshot date)
3. Compare counts - they should match

## Step 3: Verify Historical Week Assessment

### Test: Reconstruct project state for a past date
**Endpoint**: `/api/debug-historical-counts?member=Jacqueline%20Gallagher&date=2025-10-27`

**What to verify**:
- ✅ Historical count matches what was actually in Jira on that date
- ✅ Health breakdown matches what was in Jira on that date
- ✅ Projects that were assigned then are included
- ✅ Projects that weren't assigned then are excluded
- ✅ Projects that were archived before that date are excluded
- ✅ Projects that were in active statuses on that date are included

## Implementation Checklist

### Current Week Assessment
- [ ] Verify filtering logic in `workload-live` matches Jira
- [ ] Verify `getActiveHealthBreakdownForTeamMember` matches `workload-live`
- [ ] Test with all team members
- [ ] Document any discrepancies

### Snapshot Creation
- [ ] Verify `create-weekly-snapshot` uses same filtering as current week assessment
- [ ] Verify snapshot date is correct (start of week, Sunday)
- [ ] Verify counts are stored correctly in database
- [ ] Verify snapshot can be retrieved immediately

### Historical Week Assessment
- [ ] Verify `getActiveHealthBreakdownForTeamMemberAtDate` correctly reconstructs state
- [ ] Test with known dates (Oct 27, Sept 15)
- [ ] Compare with any historical records/notes
- [ ] Verify assignee changes are handled correctly
- [ ] Verify status changes are handled correctly
- [ ] Verify archive dates are handled correctly

## Debug Endpoints

1. `/api/debug-current-projects?member={name}` - Current week assessment
2. `/api/debug-workload-weekly` - What snapshot is being used
3. `/api/debug-historical-counts?member={name}&date={YYYY-MM-DD}` - Historical assessment
4. `/api/debug-capacity-data` - What snapshots exist in database

