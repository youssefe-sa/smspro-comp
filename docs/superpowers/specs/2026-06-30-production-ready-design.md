# SMSPro — Production Ready Design

## Objectif

Rendre l'application SMSPro fonctionnelle pour la production réelle : envoi SMS via Twilio, contacts persistés en base, tracking d'engagement, auto-réponses fonctionnelles, campagnes planifiées.

## État actuel

- Frontend complet (14 pages, React/TypeScript/Tailwind)
- Schéma Supabase complet (14 tables, RLS, triggers)
- Store Zustand avec logique métier (simulée)
- Edge Function `twilio-status` pour webhook de retour
- Client REST Supabase (`src/lib/supabase.ts`)

## Ce qui manque

1. **Edge Function `send-campaign`** — Aucun envoi réel de SMS
2. **Edge Function `twilio-incoming`** — Pas de traitement SMS entrants
3. **pg_cron** — Pas de traitement automatique des campagnes planifiées
4. **Store** — `sendCampaign` simulé, imports CSV non persistés
5. **Tracking** — Pas de redirection/engagement tracking

---

## Architecture cible

### 1. Edge Function: `send-campaign`

**Chemin:** `supabase/functions/send-campaign/index.ts`

**Trigger:** Appel HTTP depuis le frontend (fetch)

**Entrée:** `{ campaign_id: number }`

**Logique:**
1. Vérifier l'authentification (JWT Supabase)
2. Fetch la campagne depuis `campaigns` (vérifier ownership via RLS)
3. Fetch les contacts ciblés (opted_in = true, filtrés par segment si applicable)
4. Fetch la config Twilio depuis `users.twilio_config`
5. Pour chaque contact:
   - Personnaliser le message (`{prenom}`, `{nom}`, `{ville}`)
   - Générer un `tracking_id` unique
   - Appeler l'API Twilio `POST /Messages` avec:
     - `From`: numéro Twilio
     - `To`: téléphone contact
     - `Body`: message personnalisé
     - `StatusCallback`: URL webhook status
   - Créer un `sms_logs` entry avec `message_sid`, `status`, `cost`
6. Mettre à jour `campaigns.status` = 'sent', `sent_at`, `completed_at`
7. Retourner `{ sent: number, failed: number, total_cost: number }`

**Sécurité:**
- Auth required (JWT bearer token)
- Twilio credentials lues depuis `users.twilio_config` (pas de secrets exposés)
- Rate limiting via `rate_limits` table

### 2. Edge Function: `twilio-incoming`

**Chemin:** `supabase/functions/twilio-incoming/index.ts`

**Trigger:** Webhook Twilio (POST, form-urlencoded)

**Logique:**
1. Valider la signature Twilio (optionnel mais recommandé)
2. Extraire `From`, `Body`, `MessageSid`
3. Normaliser le numéro (`From`)
4. Chercher le contact correspondant dans `contacts`
5. Chercher les `auto_reply_rules` actives correspondant au message:
   - `match_type = 'exact'`: message === keyword (insensible à la casse)
   - `match_type = 'contains'`: message.includes(keyword)
   - `match_type = 'starts_with'`: message.startsWith(keyword)
6. Si règle trouvée:
   - Envoyer la réponse auto via Twilio API
   - Créer/MAJ `inbox_messages` (direction=inbound, keyword_detected, auto_reply_sent=true)
   - Incrémenter `trigger_count` de la règle
   - Exécuter les actions associées (opt_in, add_tag, etc.)
7. Si pas de règle: stocker dans `inbox_messages` (direction=inbound, auto_reply_sent=false)
8. Retourner TwiML vide (`<Response></Response>`)

### 3. pg_cron: Traitement campagnes planifiées

**Script SQL:**
```sql
-- Cron job toutes les 60 secondes
SELECT cron.schedule(
  'process-scheduled-campaigns',
  '* * * * *',
  $$
  -- Trouver les campagnes à envoyer
  WITH campaign_to_send AS (
    SELECT id FROM public.campaigns
    WHERE status = 'scheduled'
      AND scheduled_at <= NOW()
    LIMIT 5
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.campaigns
  SET status = 'sending', sent_at = NOW()
  WHERE id IN (SELECT id FROM campaign_to_send);
  $$
);
```

Le frontend détecte les campagnes avec `status = 'sending'` et déclenche l'envoi via l'Edge Function `send-campaign`.

### 4. Modifications Store (`src/store/useStore.ts`)

#### `sendCampaign` — Vrai envoi
```typescript
sendCampaign: async (id) => {
  // 1. Récupérer le JWT Supabase
  // 2. Appeler POST /functions/v1/send-campaign
  // 3. Mettre à jour le store avec la réponse
  // 4. En mode démo: garder la simulation actuelle
}
```

#### `importContacts` — Sync Supabase
```typescript
importContacts: async (newContacts) => {
  // 1. Si Supabase configuré: POST /rest/v1/contacts
  // 2. Sinon: garder le comportement local actuel
  // 3. Retourner le nombre importé
}
```

#### `addContact` — Sync Supabase
```typescript
addContact: async (contact) => {
  // 1. Si Supabase configuré: POST /rest/v1/contacts
  // 2. Sinon: garder le comportement local
}
```

#### `processIncomingMessage` — Vrai traitement
Appelé par le webhook Twilio (pas par le frontend).

### 5. Tracking d'engagement

**Edge Function: `track`** (`supabase/functions/track/index.ts`)
- Reçoit `GET /track/:tracking_id`
- Redirige vers l'URL originale du lien
- Enregistre `clicked_at` dans `sms_logs.engagement`

**Intégration dans `send-campaign`:**
- Les URLs dans le message sont wrappées: `https://project.supabase.co/functions/v1/track/{tracking_id}?url={encoded_url}`
- Le tracking_id est stocké dans `sms_logs.tracking_id`

### 6. Modifications UI

#### `NewCampaign.tsx`
- Le bouton "Envoyer" appelle la vraie Edge Function
- Afficher un loading pendant l'envoi
- Afficher le résultat (envoyés/échoués)
- Le bouton "Envoyer test" envoie un vrai SMS test

#### `Contacts.tsx`
- L'import CSV envoie aussi vers Supabase
- L'ajout manuel envoie vers Supabase

#### `Dashboard.tsx`
- Les stats sont lues depuis les vues Supabase (`v_user_engagement`)

#### `Settings.tsx`
- Le test Twilio envoie un vrai SMS de test
- Le test Supabase teste la vraie connexion

---

## Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `supabase/functions/send-campaign/index.ts` | Edge Function envoi SMS |
| `supabase/functions/twilio-incoming/index.ts` | Webhook SMS entrants |
| `supabase/functions/track/index.ts` | Tracking clics |
| `supabase/functions/send-test-sms/index.ts` | SMS de test |
| `supabase/migrations/add-cron-scheduled-campaigns.sql` | pg_cron |
| `supabase/migrations/add-send-sms-rls-policy.sql` | RLS pour Edge Functions |

## Fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `src/store/useStore.ts` | `sendCampaign`, `addContact`, `importContacts` → sync Supabase |
| `src/pages/NewCampaign.tsx` | Appel Edge Function, vrai envoi test |
| `src/pages/Contacts.tsx` | Import CSV → Supabase |
| `src/pages/Dashboard.tsx` | Stats depuis Supabase |
| `src/pages/Settings.tsx` | Test Twilio réel |
| `src/lib/supabase.ts` | CRUD contacts/campaigns → Supabase |
| `supabase/functions/twilio-status/index.ts` | Améliorer le webhook status |

---

## Sécurité

- Twilio credentials jamais exposés au client (stockés dans `users.twilio_config`)
- Auth Supabase requise pour toutes les Edge Functions
- RLS sur toutes les tables
- Rate limiting serveur via `rate_limits` table
- Validation des inputs (Zod côté client, vérifications Edge Function)

## Déploiement

```bash
# 1. Déployer les Edge Functions
supabase functions deploy send-campaign
supabase functions deploy twilio-incoming
supabase functions deploy twilio-status
supabase functions deploy track
supabase functions deploy send-test-sms

# 2. Configurer pg_cron (via SQL Editor)
# Voir migration add-cron-scheduled-campaigns.sql

# 3. Configurer Twilio webhook
# Numéro Twilio → Messaging → Status Callback URL
# https://YOUR-PROJECT.supabase.co/functions/v1/twilio-status

# 4. Configurer Twilio incoming webhook
# Numéro Twilio → Messaging → A MESSAGE COMES IN
# https://YOUR-PROJECT.supabase.co/functions/v1/twilio-incoming
```
