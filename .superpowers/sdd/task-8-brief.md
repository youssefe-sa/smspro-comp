# Task 8 Brief: Store Updates — Real Edge Function Calls

## Objective
Update the Zustand store and Supabase client to call real Edge Functions instead of simulating.

## Requirements

### 1. Add `getAccessToken()` to `src/lib/supabaseClient.ts`
Add after the existing `getSession` function:
```typescript
export async function getAccessToken(): Promise<string | null> {
  const client = getSupabase()
  if (!client) return null
  try {
    const { data } = await client.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}
```

### 2. Add contact CRUD to `src/lib/supabase.ts`
Add at the end of the file:
```typescript
export async function createContactSupabase(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact | null> {
  return demoGuard(async () => {
    return supabaseRequest<Contact>('contacts', {
      method: 'POST',
      body: contact,
      prefer: 'return=representation',
    })
  }).then(r => r as Contact | null)
}

export async function importContactsSupabase(contacts: Omit<Contact, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
  return demoGuard(async () => {
    const result = await supabaseRequest<Contact[]>('contacts', {
      method: 'POST',
      body: contacts,
      prefer: 'return=representation',
    })
    return Array.isArray(result) ? result.length : 0
  }).then(r => r ?? 0)
}
```

### 3. Update `sendCampaign` in `src/store/useStore.ts`
Replace the `sendCampaign` action. Key changes:
- In demo mode: keep existing simulation
- In production: call `POST {SUPABASE_URL}/functions/v1/send-campaign` with JWT auth
- On success: update campaign with real stats from response
- On error: revert campaign to 'draft', show error toast
- The function must import `getAccessToken` dynamically: `const { getAccessToken } = await import('@/lib/supabaseClient')`
- Must include `apikey` header from `VITE_SUPABASE_ANON_KEY`

### 4. Update `addContact` in store
- In demo/local mode: keep existing behavior
- In production: call `createContactSupabase()` then add result to store

### 5. Update `importContacts` in store
- In demo/local mode: keep existing behavior
- In production: call `importContactsSupabase()`, then re-fetch all contacts via `fetchContacts()`

## Files to Modify
- `src/lib/supabaseClient.ts` — add `getAccessToken()`
- `src/lib/supabase.ts` — add `createContactSupabase()`, `importContactsSupabase()`
- `src/store/useStore.ts` — update `sendCampaign`, `addContact`, `importContacts`

## Context
- The store uses Zustand with persist middleware
- `isSupabaseConfigured()` is imported from `@/lib/supabaseClient`
- `isDemo` flag in store determines demo vs production mode
- Edge Function URLs follow pattern: `{SUPABASE_URL}/functions/v1/{function-name}`
- Auth header: `Authorization: Bearer {jwt_token}`
- Apikey header: `apikey: {VITE_SUPABASE_ANON_KEY}`
- Dynamic imports are used to avoid circular dependencies

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-8-report.md`
