# Counting Discrepancy Analysis

## The Problem

The sum of projects by health does not equal the number of active projects displayed.

## Current Logic Flow

### Step 1: Initial Filtering (lines 19-42 in `workload-live/route.ts`)

Projects are filtered to create `activeProjects`:
- ✅ Excludes archived projects
- ✅ Includes only active statuses: Generative Discovery, Problem Discovery, Solution Discovery, Build, Beta
- ✅ Excludes projects where `health === 'Complete'`
- ✅ Excludes projects where `health` is null/undefined (`health &&` check)

**Result**: `activeProjects` should only contain projects with health values: On Track, At Risk, Off Track, On Hold, or Mystery.

### Step 2: Member Project Filtering (lines 68-71)

Filters `activeProjects` to `memberProjects` by assignee.
**Result**: `memberProjects` should still only have projects with valid health values (no Complete, no null).

### Step 3: Health Breakdown Calculation (lines 103-142)

Counts ALL projects in `memberProjects`:
```javascript
memberProjects.forEach(project => {
  switch (health) {
    case 'On Track': healthBreakdown.onTrack++; break;
    case 'At Risk': healthBreakdown.atRisk++; break;
    // ... etc
    case 'Complete': healthBreakdown.complete++; break;  // ⚠️ Should never happen
    default: healthBreakdown.unknown++; break;  // ⚠️ Should never happen (null health)
  }
});
```

**Problem**: The switch statement has cases for 'Complete' and 'unknown' (null), but these should never exist in `memberProjects` due to the initial filter.

### Step 4: Active Project Count (lines 144-150)

```javascript
const activeProjectCount = memberProjects.filter(project => {
  const health = project.fields.customfield_10238?.value;
  const status = project.fields.status.name;
  // Exclude complete projects only if they're in Live status (08+)
  return !(health === 'Complete' && status.startsWith('08'));
}).length;
```

**Problem**: This applies an ADDITIONAL filter that the health breakdown doesn't use. It excludes Complete projects in Live status, but:
1. Complete projects shouldn't be in `memberProjects` anyway (excluded by initial filter)
2. This filter doesn't exclude null health, but null health should also be excluded

## The Root Cause

**There are two possible issues:**

### Issue A: Initial Filter Isn't Working Correctly

The initial filter at line 38 says:
```javascript
const isActiveHealth = health && health !== 'Complete' && 
                      ['On Track', 'At Risk', 'Off Track', 'On Hold', 'Mystery'].includes(health);
```

This should exclude:
- Null/undefined health (`health &&` check fails)
- Complete health (`health !== 'Complete'` check fails)
- Any other health value not in the array

**BUT**: If somehow projects with null health or Complete health are getting through, they would:
- Be counted in health breakdown (as 'unknown' or 'complete')
- Possibly be excluded from activeProjectCount (if Complete + Live status)

### Issue B: Logic Inconsistency

The `activeProjectCount` calculation applies a DIFFERENT filter than what was used to create `memberProjects`. This is inconsistent.

**The filter at line 145-150 excludes:**
- Complete projects in Live status (08+)

**But the initial filter already excluded:**
- ALL Complete projects (regardless of status)
- ALL null health projects

So the filter at line 145-150 is redundant and confusing, and suggests the initial filter might not be working.

## The Fix

**Option 1: Make health breakdown match activeProjectCount**
- If `activeProjectCount` excludes Complete in Live status, health breakdown should too
- BUT this doesn't make sense because Complete projects shouldn't be in `memberProjects` anyway

**Option 2: Make activeProjectCount match initial filter**
- `activeProjectCount` should just be `memberProjects.length`
- The initial filter already did the work
- Remove the redundant filter at lines 145-150

**Option 3: Fix the initial filter if it's not working**
- Debug why null/Complete projects might be getting through
- Ensure the filter logic is correct

## Recommended Solution

Since the initial filter should have already excluded Complete and null health projects, `activeProjectCount` should simply be:

```javascript
const activeProjectCount = memberProjects.length;
```

And the health breakdown should already match because it counts all projects in `memberProjects`.

**But we need to verify:**
1. Are there actually any Complete projects in `memberProjects`? (Shouldn't be)
2. Are there any null health projects? (Shouldn't be)
3. Why is there a discrepancy?

## Diagnostic Steps

1. Use `/api/debug-count-discrepancy?member=Adam Sigel` to see:
   - What projects are in `memberProjects`
   - What health values they have
   - Which ones are being counted differently

2. Check if the initial filter is actually working by logging projects before and after filtering.

