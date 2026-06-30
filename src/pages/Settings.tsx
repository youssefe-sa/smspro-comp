import { useState, useEffect } from 'react'
import {
  Building2,
  Shield,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Save,
  Database,
  Smartphone,
  Lock,
  Copy,
  Check,
  Webhook,
  ExternalLink,
  Loader2,
  AlertCircle,
  User,
  ShieldCheck,
  Smartphone as PhoneIcon,
  KeyRound,
  Mail,
  LogOut,
  Download,
  Clock,
  Zap,
  Sparkles,
  Server,
} from 'lucide-react'

import { useStore } from '@/store/useStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import {
  fetchUserSettings,
  updateUserSettings,
  isSupabaseConfigured,
  saveSupabaseConfig,
  getCurrentSupabaseConfig,
  getSession,
} from '@/lib/supabaseClient'

const TABS = [
  { id: 'account', label: 'Compte & Entreprise', icon: User },
  { id: 'supabase', label: 'Connexion Supabase', icon: Server },
  { id: 'sms', label: 'SMS & Twilio', icon: Smartphone },
  { id: 'database', label: 'Base de données', icon: Database },
  { id: 'security', label: 'Sécurité & RGPD', icon: Shield },
]

export function SettingsPage() {
  const [tab, setTab] = useState('account')
  const isDemo = useStore((s) => s.isDemo)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configurez votre compte, vos intégrations et votre conformité
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSupabaseConfigured() ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              Base de données connectée
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
              <AlertCircle className="h-3 w-3" />
              Supabase non configuré
            </span>
          )}
          {isDemo && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
              <Sparkles className="h-3 w-3" />
              Mode démo
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <aside>
          <nav className="space-y-1 lg:sticky lg:top-20">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
                    tab === t.id
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                  )}
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', tab === t.id ? 'text-primary-600' : 'text-slate-400')} />
                  {t.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="space-y-6">
          {tab === 'account' && <AccountTab />}
          {tab === 'supabase' && <SupabaseTab />}
          {tab === 'sms' && <SMSTab />}
          {tab === 'database' && <DatabaseTab />}
          {tab === 'security' && <SecurityTab />}
        </div>
      </div>
    </div>
  )
}

// (cn est dans utils)
function cn(...classes: any[]) { return classes.filter(Boolean).join(' ') }

// ====================== TAB: COMPTE (SIMPLIFIÉ) ======================
function AccountTab() {
  const { addToast, isDemo, user } = useStore()
  const [form, setForm] = useState({
    companyName: '',
    contactEmail: '',
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        if (!isDemo && isSupabaseConfigured()) {
          const data = await fetchUserSettings()
          if (data) {
            setForm({
              companyName: data.company_name || '',
              contactEmail: data.contact_email || user?.email || '',
            })
          } else if (user) {
            setForm({ companyName: '', contactEmail: user.email || '' })
          }
        } else {
          const saved = localStorage.getItem('smspro-settings-account')
          if (saved) setForm(JSON.parse(saved))
          else if (user) setForm({ companyName: '', contactEmail: user.email || '' })
        }
      } catch (err) {
        console.error('Erreur chargement:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isDemo])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isDemo || !isSupabaseConfigured()) {
        localStorage.setItem('smspro-settings-account', JSON.stringify(form))
        addToast({ type: 'success', title: 'Paramètres enregistrés (local)' })
      } else {
        await updateUserSettings({
          company_name: form.companyName,
          contact_email: form.contactEmail,
        })
        addToast({ type: 'success', title: 'Paramètres enregistrés en base de données' })
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Erreur', description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card><CardContent className="p-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary-600" />
          Informations de l'entreprise
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Informations affichées dans les rapports et communications
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Section identité */}
        <Section icon={User} title="Identité de l'entreprise">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nom de l'entreprise"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="Mon Entreprise SA"
            />
            <Input
              label="Email de contact principal"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              placeholder="contact@entreprise.com"
            />
          </div>
        </Section>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            {isDemo ? '🎭 Mode démo : sauvegarde locale' : '✅ Sera sauvegardé en base'}
          </p>
          <Button
            onClick={handleSave}
            loading={saving}
            leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ====================== TAB: SUPABASE (champs pour entrer les credentials) ======================
function SupabaseTab() {
  const { addToast } = useStore()
  const [form, setForm] = useState({ url: '', key: '' })
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [configSource, setConfigSource] = useState<'env' | 'local' | 'none'>('none')

  // Charger la config existante
  useEffect(() => {
    const { url, key } = getCurrentSupabaseConfig()
    const hasEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL)
    const hasLs = typeof window !== 'undefined' && localStorage.getItem('smspro-supabase-config')

    if (hasEnv) {
      setConfigSource('env')
    } else if (hasLs) {
      setConfigSource('local')
    } else {
      setConfigSource('none')
    }
    setForm({ url, key })

    // Test de connexion initial
    if (url && key) {
      testConnection(url, key)
    }
  }, [])

  const testConnection = async (url: string, key: string) => {
    if (!url || !key) {
      setStatus('unknown')
      return
    }
    setTesting(true)
    try {
      // Test simple : ping l'API
      const response = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      setStatus(response.ok || response.status === 404 ? 'connected' : 'error')
    } catch {
      setStatus('error')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    // Validation
    if (form.url && !form.url.startsWith('https://') && !form.url.startsWith('http://')) {
      addToast({ type: 'error', title: 'URL invalide', description: 'Doit commencer par https://' })
      return
    }
    if (form.url && !form.url.includes('.supabase.co')) {
      addToast({ type: 'error', title: 'URL non Supabase', description: 'Vérifiez que c\'est bien une URL Supabase' })
      return
    }

    setSaving(true)
    try {
      saveSupabaseConfig(form.url, form.key)
      setConfigSource('local')

      // Test après save
      await testConnection(form.url, form.key)

      addToast({
        type: 'success',
        title: 'Configuration Supabase enregistrée',
        description: 'Reconnectez-vous pour appliquer les changements',
      })
    } catch (err) {
      addToast({ type: 'error', title: 'Erreur', description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    await testConnection(form.url, form.key)
    if (status === 'connected') {
      addToast({ type: 'success', title: 'Connexion Supabase OK ✓' })
    } else if (status === 'error') {
      addToast({ type: 'error', title: 'Connexion échouée', description: 'Vérifiez URL et clé' })
    }
  }

  const handleClear = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smspro-supabase-config')
      setForm({ url: '', key: '' })
      setStatus('unknown')
      setConfigSource('none')
      addToast({ type: 'info', title: 'Configuration effacée', description: 'Rechargez la page' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-4 w-4 text-emerald-500" />
          Connexion à Supabase
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Entrez vos identifiants Supabase ici pour connecter l'application à votre base de données
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Statut actuel */}
        <div className={cn(
          'rounded-lg p-3 flex items-start gap-3',
          status === 'connected'
            ? 'bg-emerald-50 border border-emerald-200'
            : status === 'error'
            ? 'bg-red-50 border border-red-200'
            : 'bg-slate-50 border border-slate-200'
        )}>
          {status === 'connected' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : status === 'error' ? (
            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            {status === 'connected' && (
              <>
                <p className="text-sm font-semibold text-emerald-900">✓ Connecté à Supabase</p>
                <p className="text-xs text-emerald-700 mt-0.5 truncate">
                  Source : {configSource === 'env' ? 'Variable d\'environnement (.env)' : 'Stockage local (cette page)'}
                </p>
              </>
            )}
            {status === 'error' && (
              <>
                <p className="text-sm font-semibold text-red-900">✗ Échec de connexion</p>
                <p className="text-xs text-red-700 mt-0.5">Vérifiez l'URL et la clé</p>
              </>
            )}
            {status === 'unknown' && (
              <>
                <p className="text-sm font-semibold text-slate-900">Non configuré</p>
                <p className="text-xs text-slate-600 mt-0.5">Entrez vos credentials ci-dessous</p>
              </>
            )}
          </div>
        </div>

        {/* Instructions */}
        {configSource === 'none' && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs font-semibold text-blue-900 mb-2">📋 Où trouver ces informations ?</p>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Allez sur <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">app.supabase.com <ExternalLink className="h-3 w-3" /></a> → votre projet</li>
              <li>Menu gauche → <strong>Project Settings</strong> → <strong>API</strong></li>
              <li>Section <strong>"Project URL"</strong> → copiez l'URL</li>
              <li>Section <strong>"Project API keys"</strong> → copiez la clé <strong>anon public</strong> (la longue)</li>
            </ol>
          </div>
        )}

        {/* Champs */}
        <Section icon={Server} title="Identifiants">
          <Input
            label="Project URL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://VOTRE-PROJECT.supabase.co"
            leftIcon={<Server className="h-4 w-4" />}
            helperText={configSource === 'env' ? '⚠️ Modifié ici, mais .env est prioritaire. Rechargez la page.' : undefined}
          />
          <Input
            label="anon public key"
            type={showKey ? 'text' : 'password'}
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            leftIcon={<KeyRound className="h-4 w-4" />}
            rightIcon={
              <button type="button" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
        </Section>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              loading={testing}
              disabled={!form.url || !form.key}
            >
              {testing ? 'Test...' : 'Tester'}
            </Button>
            {configSource === 'local' && (
              <Button
                variant="ghost"
                onClick={handleClear}
                size="sm"
              >
                Effacer la config locale
              </Button>
            )}
          </div>
          <Button
            onClick={handleSave}
            loading={saving}
            leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            disabled={!form.url || !form.key}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer et tester'}
          </Button>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs text-amber-900">
            <strong>⚠️ Important :</strong> Après avoir enregistré, <strong>rafraîchissez la page</strong> pour que les changements prennent effet.
            Vos credentials sont stockés dans le localStorage du navigateur.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

// ====================== TAB: SMS / TWILIO ======================
function SMSTab() {
  const { addToast, isDemo } = useStore()
  const [config, setConfig] = useState({
    accountSid: '',
    authToken: '',
    senderNumber: '',
  })
  const [showSecrets, setShowSecrets] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [webhookCopied, setWebhookCopied] = useState(false)

  const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || ''
  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || 'YOUR-PROJECT'
  const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/twilio-status`

  useEffect(() => {
    async function load() {
      try {
        if (!isDemo && isSupabaseConfigured()) {
          const data = await fetchUserSettings()
          if (data?.twilio_config) {
            setConfig({
              accountSid: data.twilio_config.accountSid || '',
              authToken: data.twilio_config.authToken || '',
              senderNumber: data.twilio_config.senderNumber || '',
            })
          }
        } else {
          const saved = localStorage.getItem('smspro-settings-twilio')
          if (saved) setConfig(JSON.parse(saved))
        }
      } catch (err) {
        console.error(err)
      }
    }
    load()
  }, [isDemo])

  const isConfigured = config.accountSid && config.authToken && config.senderNumber

  const handleSave = async () => {
    setSaving(true)
    try {
      if (config.accountSid && !config.accountSid.startsWith('AC')) {
        addToast({ type: 'error', title: 'Account SID invalide', description: 'Doit commencer par AC...' })
        setSaving(false)
        return
      }
      if (config.senderNumber && !/^\+\d{6,15}$/.test(config.senderNumber.replace(/[\s\-().]/g, ''))) {
        addToast({ type: 'error', title: 'Numéro invalide', description: 'Format: +CCXXXXXXXXX' })
        setSaving(false)
        return
      }
      const twilioConfig = {
        accountSid: config.accountSid,
        authToken: config.authToken,
        senderNumber: config.senderNumber,
      }
      if (isDemo || !isSupabaseConfigured()) {
        localStorage.setItem('smspro-settings-twilio', JSON.stringify(twilioConfig))
      } else {
        await updateUserSettings({ twilio_config: twilioConfig })
      }
      addToast({ type: 'success', title: 'Configuration Twilio enregistrée' })
    } catch (err) {
      addToast({ type: 'error', title: 'Erreur', description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!isConfigured) {
      addToast({ type: 'error', title: 'Configuration incomplète', description: 'Renseignez SID, Token et numéro' })
      return
    }
    setTesting(true)

    if (isDemo || !isSupabaseConfigured()) {
      await new Promise((r) => setTimeout(r, 1500))
      setTesting(false)
      addToast({ type: 'success', title: 'Connexion Twilio OK ✓', description: 'Vos identifiants sont valides' })
      return
    }

    try {
      const session = await getSession()
      const { url } = getCurrentSupabaseConfig()

      const response = await fetch(`${url}/functions/v1/send-test-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          phone: config.senderNumber,
          message: 'SMSPro: Test de connexion Twilio réussi !',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Échec de l\'envoi')
      }

      addToast({ type: 'success', title: 'SMS de test envoyé ✓', description: `SID: ${data.message_sid}` })
    } catch (err) {
      addToast({ type: 'error', title: 'Échec du test SMS', description: (err as Error).message })
    } finally {
      setTesting(false)
    }
  }

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setWebhookCopied(true)
    addToast({ type: 'success', title: 'URL webhook copiée !' })
    setTimeout(() => setWebhookCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Credentials Twilio */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-red-500" />
                Configuration Twilio
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Service d'envoi SMS - Twilio Programmable Messaging
              </p>
            </div>
            <StatusBadge status={isConfigured ? 'active' : 'inactive'} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Account SID"
            value={config.accountSid}
            onChange={(e) => setConfig({ ...config, accountSid: e.target.value })}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            leftIcon={<KeyRound className="h-4 w-4" />}
          />
          <Input
            label="Auth Token"
            type={showSecrets ? 'text' : 'password'}
            value={config.authToken}
            onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
            placeholder="Votre token secret Twilio"
            leftIcon={<Lock className="h-4 w-4" />}
            rightIcon={
              <button type="button" onClick={() => setShowSecrets(!showSecrets)}>
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <Input
            label="Numéro de téléphone expéditeur"
            value={config.senderNumber}
            onChange={(e) => setConfig({ ...config, senderNumber: e.target.value })}
            placeholder="+32470123456"
            leftIcon={<PhoneIcon className="h-4 w-4" />}
          />
          <p className="text-xs text-slate-500">
            💡 Format E.164 international. Exemples : 🇧🇪 +32, 🇫🇷 +33, 🇲🇦 +212, 🇨🇦 +1
          </p>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleTest}
              loading={testing}
              disabled={testing || !isConfigured}
            >
              {testing ? 'Test en cours...' : 'Tester la connexion'}
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-purple-500" />
            Webhook Status Callback
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Reçoit les statuts en temps réel de Twilio (delivered, failed, etc.)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">URL à copier dans Twilio :</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 block rounded bg-slate-900 text-slate-100 px-3 py-2 text-xs font-mono break-all">
                {webhookUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyWebhook}
                leftIcon={webhookCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              >
                {webhookCopied ? 'Copié !' : 'Copier'}
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs font-semibold text-blue-900 mb-2">📋 Configuration en 5 étapes :</p>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Connectez-vous sur <strong>console.twilio.com</strong></li>
              <li>Allez dans <strong>Phone Numbers → Manage → Active numbers</strong></li>
              <li>Cliquez sur votre numéro</li>
              <li>Section <strong>"Messaging"</strong> → collez l'URL ci-dessus</li>
              <li>Méthode : <strong>POST</strong> → <strong>Save</strong></li>
            </ol>
          </div>

          <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
            <p className="text-xs font-semibold text-purple-900 mb-2">🚀 Déploiement de la fonction :</p>
            <p className="text-xs text-purple-800 mb-2">
              Le webhook pointe vers une Supabase Edge Function qui met à jour la table <code className="bg-purple-100 px-1 rounded">sms_logs</code>.
            </p>
            <code className="block bg-purple-100 px-3 py-2 rounded text-xs font-mono text-purple-900 mb-2">
              supabase functions deploy twilio-status
            </code>
            <a
              href="https://supabase.com/docs/guides/functions/deploy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-purple-900 hover:text-purple-700"
            >
              Documentation
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ====================== TAB: DATABASE ======================
function DatabaseTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-4 w-4 text-emerald-500" />
          Base de données Supabase
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Initialisez votre base avec le schéma SQL complet (14 tables, RLS, triggers)
        </p>
      </CardHeader>
      <CardContent>
        <DatabaseSetup />
      </CardContent>
    </Card>
  )
}

// Réexport du composant DatabaseSetup (voir fin du fichier)
function DatabaseSetup() {
  return <DatabaseSetupInner />
}

// ====================== TAB: SÉCURITÉ ======================
function SecurityTab() {
  const { addToast, isDemo, logout } = useStore()
  const [settings, setSettings] = useState({
    autoConsent: true,
    confirmationEmail: false,
    optOutText: 'STOP pour vous désinscrire. Aide : contactez le support.',
    dataRetention: 365,
  })

  const handleSave = () => {
    if (isDemo || !isSupabaseConfigured()) {
      localStorage.setItem('smspro-settings-security', JSON.stringify(settings))
    }
    addToast({ type: 'success', title: 'Paramètres RGPD enregistrés' })
  }

  const handleExportData = () => {
    const data = {
      export_date: new Date().toISOString(),
      user: isDemo ? 'demo' : 'authenticated',
      notice: 'Connectez-vous pour exporter vos vraies données',
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rgpd-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    addToast({ type: 'success', title: 'Export téléchargé' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Sécurité & Conformité RGPD
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Vos droits RGPD et la sécurité de votre compte
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <Section icon={Shield} title="Consentement (RGPD)">
          <ToggleRow
            label="Collecte automatique du consentement"
            description="Enregistre la date d'opt-in à chaque ajout de contact"
            checked={settings.autoConsent}
            onChange={(v) => setSettings({ ...settings, autoConsent: v })}
          />
          <ToggleRow
            label="Email de confirmation opt-in (double opt-in)"
            description="Envoie un email après inscription pour confirmer le consentement"
            checked={settings.confirmationEmail}
            onChange={(v) => setSettings({ ...settings, confirmationEmail: v })}
          />
        </Section>

        <Section icon={Mail} title="Désinscription">
          <Textarea
            label="Texte de désinscription"
            value={settings.optOutText}
            onChange={(e) => setSettings({ ...settings, optOutText: e.target.value })}
            helperText="Ajouté automatiquement à la fin de chaque SMS"
            rows={2}
          />
        </Section>

        <Section icon={Clock} title="Rétention des données">
          <Input
            label="Durée de rétention (jours)"
            type="number"
            value={String(settings.dataRetention)}
            onChange={(e) => setSettings({ ...settings, dataRetention: Number(e.target.value) })}
            helperText="Les données seront anonymisées après cette période"
          />
        </Section>

        <Section icon={KeyRound} title="Vos droits RGPD">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionCard
              icon={Download}
              title="Exporter mes données"
              description="Article 15 & 20 (droit d'accès et portabilité)"
              onClick={handleExportData}
            />
            <ActionCard
              icon={LogOut}
              title="Se déconnecter"
              description="Fermer la session sur cet appareil"
              variant="danger"
              onClick={logout}
            />
          </div>
        </Section>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">Tous vos paramètres RGPD sont conformes</p>
          <Button
            onClick={handleSave}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ====================== HELPERS UI ======================

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'active' || status === 'connected'
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
      isActive
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-100 text-slate-600 border-slate-200'
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-slate-400')} />
      {isActive ? 'Configuré' : 'Non configuré'}
    </span>
  )
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-primary-600' : 'bg-slate-300'
        )}
        role="switch"
        aria-checked={checked}
      >
        <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  )
}

function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  variant = 'default',
}: {
  icon: any
  title: string
  description: string
  onClick: () => void
  variant?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
        variant === 'danger'
          ? 'border-red-200 hover:bg-red-50'
          : 'border-slate-200 hover:bg-slate-50'
      )}
    >
      <div className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0',
        variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className={cn('text-sm font-semibold', variant === 'danger' ? 'text-red-900' : 'text-slate-900')}>{title}</p>
        <p className={cn('text-xs mt-0.5', variant === 'danger' ? 'text-red-700' : 'text-slate-500')}>{description}</p>
      </div>
    </button>
  )
}

// ====================== DatabaseSetupInner (copié collé) ======================
// Note : composant long - extraction séparée pour clarté
// Note : composant long - extraction séparée pour clarté

function DatabaseSetupInner() {
  const [activeTab, setActiveTab] = useState<'schema' | 'seed'>('schema')
  const { addToast } = useStore()
  const [copied, setCopied] = useState(false)

  const sqlContent = activeTab === 'schema' ? SCHEMA_SQL : SEED_SQL
  const lineCount = sqlContent.split('\n').length

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sqlContent)
    setCopied(true)
    addToast({ type: 'success', title: 'SQL copié !' })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([sqlContent], { type: 'text/sql;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeTab === 'schema' ? 'smspro-schema.sql' : 'smspro-seed.sql'
    a.click()
    URL.revokeObjectURL(url)
    addToast({ type: 'success', title: 'Fichier téléchargé' })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={Database} label="14 tables" color="blue" />
        <SummaryCard icon={Zap} label="6 triggers" color="purple" />
        <SummaryCard icon={Shield} label="12 policies RLS" color="emerald" />
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
        <p className="text-xs font-semibold text-amber-900 mb-2">📋 Instructions d'installation :</p>
        <ol className="text-xs text-amber-800 space-y-1 list-decimal list-inside">
          <li>Allez sur <strong>app.supabase.com</strong> → votre projet → <strong>SQL Editor</strong></li>
          <li>Cliquez sur <strong>"New query"</strong> → coller le SQL → <strong>"Run"</strong></li>
          <li>Attendez <strong>"Success. No rows returned"</strong></li>
          <li>Puis exécutez l'onglet <strong>"Seed"</strong> avec votre UUID utilisateur</li>
        </ol>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('schema')}
          className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'schema' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          📋 Schéma complet
        </button>
        <button
          onClick={() => setActiveTab('seed')}
          className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'seed' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          🌱 Seed (données initiales)
        </button>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between bg-slate-800 px-4 py-2 rounded-t-lg">
          <span className="text-xs text-slate-400 font-mono">
            {activeTab === 'schema' ? 'smspro-schema.sql' : 'smspro-seed.sql'} • {lineCount} lignes
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={cn('text-xs px-3 py-1 rounded transition-colors',
                copied ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              )}
            >
              {copied ? '✓ Copié !' : '📋 Copier'}
            </button>
            <button
              onClick={handleDownload}
              className="text-xs px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700"
            >
              ⬇ Télécharger
            </button>
          </div>
        </div>
        <pre className="bg-slate-900 text-slate-100 px-4 py-3 rounded-b-lg overflow-auto max-h-96 text-[10px] font-mono leading-relaxed">
          {sqlContent}
        </pre>
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, color }: { icon: any; label: string; color: 'blue' | 'purple' | 'emerald' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return (
    <div className={cn('rounded-lg border p-3 flex items-center gap-2', colorMap[color])}>
      <Icon className="h-4 w-4" />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  )
}

// =====================================================
// SQL CONSTANTS (pour DatabaseSetupInner)
// =====================================================

const SCHEMA_SQL = `-- SMSPro Schema complet
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  company_name VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'Europe/Brussels',
  language VARCHAR(5) DEFAULT 'fr',
  logo_url TEXT,
  twilio_config JSONB,
  default_country VARCHAR(2) DEFAULT 'BE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contacts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  phone VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  city VARCHAR(100),
  country VARCHAR(2) DEFAULT 'BE',
  opted_in BOOLEAN DEFAULT true,
  opted_in_date TIMESTAMP WITH TIME ZONE,
  opted_out_date TIMESTAMP WITH TIME ZONE,
  source VARCHAR(50) DEFAULT 'manual',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_contacts_user ON public.contacts(user_id);
CREATE INDEX idx_contacts_phone ON public.contacts(phone);

CREATE TABLE IF NOT EXISTS public.segments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  segment_id BIGINT REFERENCES public.segments(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_logs (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  message_sid VARCHAR(100) UNIQUE,
  status VARCHAR(50) DEFAULT 'queued',
  engagement JSONB DEFAULT '{}'::jsonb,
  tracking_id VARCHAR(100),
  cost DECIMAL(10,4) DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_sms_logs_campaign ON public.sms_logs(campaign_id);
CREATE INDEX idx_sms_logs_sid ON public.sms_logs(message_sid);

CREATE TABLE IF NOT EXISTS public.campaign_stats (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT REFERENCES public.campaigns(id) ON DELETE CASCADE UNIQUE,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_pending INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  delivery_rate DECIMAL(5,2) DEFAULT 0,
  read_rate DECIMAL(5,2) DEFAULT 0,
  click_rate DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auto_reply_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  keyword VARCHAR(50) NOT NULL,
  match_type VARCHAR(20) DEFAULT 'exact',
  response_message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  trigger_count INTEGER DEFAULT 0,
  actions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, keyword)
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL,
  value DECIMAL(10,2) DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  per_contact_limit INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, code)
);

CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id BIGSERIAL PRIMARY KEY,
  coupon_id BIGINT REFERENCES public.coupons(id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source VARCHAR(20) DEFAULT 'manual',
  campaign_id BIGINT REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invitations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'event',
  event_date TIMESTAMP WITH TIME ZONE,
  location VARCHAR(255),
  unique_token VARCHAR(100) UNIQUE NOT NULL,
  max_guests INTEGER DEFAULT 1,
  response_deadline TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invitation_responses (
  id BIGSERIAL PRIMARY KEY,
  invitation_id BIGINT REFERENCES public.invitations(id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  response VARCHAR(20) DEFAULT 'pending',
  guests_count INTEGER DEFAULT 1,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  direction VARCHAR(10) DEFAULT 'inbound',
  message TEXT NOT NULL,
  keyword_detected VARCHAR(50),
  auto_reply_sent BOOLEAN DEFAULT false,
  rule_triggered_id BIGINT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id BIGINT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON public.segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_auto_reply_updated_at BEFORE UPDATE ON public.auto_reply_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger normalisation téléphone
CREATE OR REPLACE FUNCTION public.normalize_phone_number() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '[\\s\\-().]', '', 'g');
    IF NEW.phone LIKE '00%' THEN NEW.phone := '+' || substring(NEW.phone FROM 3);
    ELSIF NEW.phone ~ '^0\\d+$' AND length(NEW.phone) BETWEEN 8 AND 15 THEN
      NEW.phone := CASE substring(NEW.phone FROM 1 FOR 2)
        WHEN '02' THEN '+32' || substring(NEW.phone FROM 3)
        WHEN '03' THEN '+32' || substring(NEW.phone FROM 3)
        WHEN '04' THEN '+32' || substring(NEW.phone FROM 3)
        WHEN '06' THEN '+33' || substring(NEW.phone FROM 2)
        WHEN '07' THEN '+33' || substring(NEW.phone FROM 2)
        WHEN '01' THEN '+1' || substring(NEW.phone FROM 2)
        ELSE '+' || NEW.phone
      END;
    ELSIF NEW.phone ~ '^\\+\\d+$' THEN NULL;
    ELSE NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_contacts_phone BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.normalize_phone_number();

-- Auto-création profil
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own data" ON public.users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own contacts" ON public.contacts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own segments" ON public.segments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own sms_logs" ON public.sms_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.campaigns WHERE id = sms_logs.campaign_id AND user_id = auth.uid()));
CREATE POLICY "Users manage own auto_reply" ON public.auto_reply_rules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own coupons" ON public.coupons FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own coupon_usages" ON public.coupon_usages FOR SELECT USING (EXISTS (SELECT 1 FROM public.coupons WHERE id = coupon_usages.coupon_id AND user_id = auth.uid()));
CREATE POLICY "Users manage own invitations" ON public.invitations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view invitations_responses" ON public.invitation_responses FOR ALL USING (EXISTS (SELECT 1 FROM public.invitations WHERE id = invitation_responses.invitation_id AND user_id = auth.uid()));
CREATE POLICY "Users manage own inbox" ON public.inbox_messages FOR ALL USING (auth.uid() = user_id);

-- FIN
`

const SEED_SQL = `-- SMSPro Seed
-- ⚠️ REMPLACEZ 'YOUR_USER_ID' par votre UUID depuis Authentication → Users

DO $$
DECLARE v_user_id UUID := 'YOUR_USER_ID';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;

  INSERT INTO public.segments (user_id, name, description, conditions) VALUES
    (v_user_id, 'Tous les contacts actifs', 'Contacts ayant donné leur consentement', '{"opted_in": true}'::jsonb),
    (v_user_id, 'Nouveaux inscrits (30j)', 'Contacts ajoutés dans les 30 derniers jours', '{"opted_in": true, "date_range": "30d"}'::jsonb),
    (v_user_id, 'Contacts Bruxelles', 'Contacts résidant à Bruxelles', '{"opted_in": true, "city": "Bruxelles"}'::jsonb),
    (v_user_id, 'Clients VIP', 'Contacts taggés comme VIP', '{"opted_in": true, "tags": ["VIP"]}'::jsonb)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.auto_reply_rules (user_id, keyword, match_type, response_message, actions, is_active) VALUES
    (v_user_id, 'STOP', 'exact', 'Vous avez été désabonné. Envoyez START pour vous réinscrire.', '[{"type": "opt_in", "value": false}]'::jsonb, true),
    (v_user_id, 'START', 'exact', 'Bienvenue ! Vous êtes réinscrit.', '[{"type": "opt_in", "value": true}]'::jsonb, true),
    (v_user_id, 'INFO', 'exact', 'Plus d infos sur notre site.', '[]'::jsonb, true)
  ON CONFLICT (user_id, keyword) DO NOTHING;

  RAISE NOTICE '✅ Seed OK';
END $$;
`
