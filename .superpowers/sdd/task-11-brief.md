# Task 11 Brief: Dashboard.tsx — Real Stats from Supabase

## Objective
Update Dashboard.tsx to fetch real statistics from Supabase views when available.

## Requirements

### 1. Add state and useEffect for real stats
At the top of the DashboardPage component, add:
```typescript
const [realStats, setRealStats] = useState<{
  totalContacts: number
  activeContacts: number
  totalCampaigns: number
  totalSent: number
  totalDelivered: number
  totalCost: number
  deliveryRate: number
} | null>(null)

useEffect(() => {
  async function loadRealStats() {
    if (isDemo || !isSupabaseConfigured()) return
    try {
      const { fetchDashboardStats } = await import('@/lib/supabase')
      const stats = await fetchDashboardStats()
      setRealStats(stats)
    } catch {
      // Fallback to local stats
    }
  }
  loadRealStats()
}, [isDemo])
```

### 2. Use realStats when displaying KPIs
Where the dashboard displays stats (total contacts, campaigns, sent, delivered, cost, delivery rate), use `realStats?.totalContacts ?? localTotalContacts` pattern.

### 3. Add imports
- `useState, useEffect` from react (may already be imported)
- `isSupabaseConfigured` from `@/lib/supabaseClient`

## Files to Modify
- `src/pages/Dashboard.tsx`

## Context
- `fetchDashboardStats` already exists in `src/lib/supabase.ts` — it calls the `v_user_engagement` view
- The dashboard currently reads from the local Zustand store
- When `realStats` is available, it should take precedence over local data

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-11-report.md`
