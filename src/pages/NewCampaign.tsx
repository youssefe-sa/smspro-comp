import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MessageSquare,
  Users,
  Calendar,
  Send,
  Smartphone,
  Sparkles,
  TestTube2,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { cn } from '@/utils/cn'
import { calculateSMSCount, formatCurrency, personalizeMessage } from '@/lib/utils'
import { mockSegments } from '@/lib/mockData'
import { isSupabaseConfigured } from '@/lib/supabaseClient'

const TEMPLATES = [
  { id: 't1', label: 'Promotion', icon: '🎉', text: 'Bonjour {prenom}, profitez de -20% sur toute la collection avec le code PROMO20. Valable jusqu\'au 31/12 !' },
  { id: 't2', label: 'Rappel RDV', icon: '📅', text: 'Cher {prenom}, nous vous rappelons votre rendez-vous demain à 14h30. Merci de votre confiance.' },
  { id: 't3', label: 'Confirmation', icon: '✓', text: 'Bonjour {prenom}, votre commande est confirmée. Livraison prévue sous 48h à {ville}.' },
  { id: 't4', label: 'Bienvenue', icon: '👋', text: 'Bienvenue {prenom} ! Merci pour votre inscription. Bénéficiez de 10% sur votre première commande.' },
]

const STEPS = [
  { id: 1, label: 'Message', icon: MessageSquare },
  { id: 2, label: 'Destinataires', icon: Users },
  { id: 3, label: 'Planification', icon: Calendar },
]

export function NewCampaignPage() {
  const navigate = useNavigate()
  const { contacts, addCampaign, addToast, isDemo } = useStore()
  const [step, setStep] = useState(1)
  const [sending, setSending] = useState(false)
  const [testSent, setTestSent] = useState(false)
  const [testPhone, setTestPhone] = useState('')

  const [form, setForm] = useState({
    name: '',
    message: '',
    segmentType: 'all' as 'all' | 'segment' | 'custom',
    segmentId: 1,
    customContactIds: [] as number[],
    sendType: 'now' as 'now' | 'schedule',
    scheduledDate: '',
    scheduledTime: '',
  })

  const activeContacts = useMemo(() => contacts.filter((c) => c.opted_in), [contacts])
  const segments = mockSegments

  const targetContacts = useMemo(() => {
    if (form.segmentType === 'all') return activeContacts
    if (form.segmentType === 'segment') {
      const seg = segments.find((s) => s.id === form.segmentId)
      if (!seg) return []
      if (form.segmentId === 2) return activeContacts.filter((c) => c.city === 'Bruxelles')
      if (form.segmentId === 3) return activeContacts.filter((c) => c.tags.includes('VIP'))
      if (form.segmentId === 4) {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return activeContacts.filter((c) => new Date(c.created_at) > thirtyDaysAgo)
      }
      return activeContacts
    }
    return contacts.filter((c) => form.customContactIds.includes(c.id))
  }, [form.segmentType, form.segmentId, form.customContactIds, activeContacts, contacts, segments])

  const smsCount = calculateSMSCount(form.message)
  const estimatedCost = targetContacts.length * 0.08

  // Prévisualisation message
  const previewMessage = useMemo(() => {
    const sample = activeContacts[0]
    return personalizeMessage(form.message, sample || { first_name: 'Lucas', last_name: 'Peeters', city: 'Bruxelles' })
  }, [form.message, activeContacts])

  const insertVariable = (variable: string) => {
    setForm({ ...form, message: form.message + `{${variable}}` })
  }

  const handleNext = () => {
    if (step === 1) {
      if (!form.name.trim() || form.name.length < 3) {
        addToast({ type: 'error', title: 'Nom requis', description: 'Au moins 3 caractères.' })
        return
      }
      if (!form.message.trim()) {
        addToast({ type: 'error', title: 'Message vide', description: 'Saisissez votre message.' })
        return
      }
    }
    if (step === 2 && targetContacts.length === 0) {
      addToast({ type: 'error', title: 'Aucun destinataire', description: 'Sélectionnez au moins un contact.' })
      return
    }
    if (step === 3 && form.sendType === 'schedule') {
      if (!form.scheduledDate || !form.scheduledTime) {
        addToast({ type: 'error', title: 'Date manquante', description: 'Sélectionnez date et heure.' })
        return
      }
    }
    setStep(step + 1)
  }

  const handleSendTest = async () => {
    if (!testPhone) {
      addToast({ type: 'error', title: 'Numéro requis' })
      return
    }
    setTestSent(false)

    // Production mode: call real Edge Function
    if (!isDemo && isSupabaseConfigured()) {
      try {
        const { getAccessToken } = await import('@/lib/supabaseClient')
        const token = await getAccessToken()
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
        const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

        const response = await fetch(`${supabaseUrl}/functions/v1/send-test-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({ phone: testPhone, message: form.message }),
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(errText || `HTTP ${response.status}`)
        }

        setTestSent(true)
        addToast({ type: 'success', title: 'SMS test envoyé !', description: `Vérifiez le ${testPhone}` })
      } catch (err) {
        addToast({ type: 'error', title: 'Erreur envoi test', description: (err as Error).message })
        setTestSent(false)
      }
    } else {
      // Demo mode: simulate
      setTimeout(() => {
        setTestSent(true)
        addToast({ type: 'success', title: 'SMS test envoyé !', description: `Vérifiez le ${testPhone}` })
      }, 1000)
    }
  }

  const handleSend = async () => {
    setSending(true)
    addCampaign({
      user_id: 'user-1',
      name: form.name,
      message: form.message,
      segment_id: form.segmentType === 'segment' ? form.segmentId : undefined,
      status: form.sendType === 'schedule' ? 'scheduled' : 'sending',
      scheduled_at: form.sendType === 'schedule' ? new Date(`${form.scheduledDate}T${form.scheduledTime}`).toISOString() : undefined,
    })
    await new Promise((r) => setTimeout(r, 500))
    addToast({
      type: 'success',
      title: form.sendType === 'schedule' ? 'Campagne planifiée' : 'Campagne envoyée !',
      description: `${targetContacts.length} destinataires`,
    })
    setSending(false)
    navigate('/campaigns')
  }

  const handleSaveDraft = () => {
    addCampaign({
      user_id: 'user-1',
      name: form.name || 'Brouillon',
      message: form.message,
      segment_id: form.segmentType === 'segment' ? form.segmentId : undefined,
      status: 'draft',
    })
    addToast({ type: 'info', title: 'Brouillon enregistré' })
    navigate('/campaigns')
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/campaigns" className="rounded-lg p-2 hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nouvelle campagne</h1>
          <p className="text-sm text-slate-500">Créez et envoyez votre campagne SMS en quelques étapes</p>
        </div>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const active = step === s.id
              const completed = step > s.id
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-all',
                        completed ? 'bg-emerald-500 text-white' :
                        active ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' :
                        'bg-slate-100 text-slate-400'
                      )}
                    >
                      {completed ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <p className={cn(
                      'text-xs font-medium mt-2',
                      active ? 'text-primary-700' : completed ? 'text-emerald-700' : 'text-slate-500'
                    )}>
                      {s.label}
                    </p>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn(
                      'flex-1 h-1 mx-2 rounded-full transition-colors',
                      completed ? 'bg-emerald-500' : 'bg-slate-200'
                    )} />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step content */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <Input
                label="Nom de la campagne *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Promo Black Friday 2024"
                helperText="Visible uniquement par vous"
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Message SMS *
                </label>
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Écrivez votre message ici..."
                  rows={5}
                  maxLength={1600}
                />
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500">
                      {form.message.length} / 160 caractères
                    </p>
                    {smsCount > 1 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">
                        {smsCount} SMS
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 mr-1">Variables:</span>
                    <button onClick={() => insertVariable('prenom')} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200">
                      {'{prenom}'}
                    </button>
                    <button onClick={() => insertVariable('nom')} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200">
                      {'{nom}'}
                    </button>
                    <button onClick={() => insertVariable('ville')} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200">
                      {'{ville}'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Modèles rapides
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setForm({ ...form, message: t.text })}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-primary-300 hover:bg-primary-50 transition-colors"
                    >
                      <span className="text-lg">{t.icon}</span>
                      <span className="text-xs font-medium text-slate-700">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1">
                  <Smartphone className="h-3 w-3" /> Aperçu sur mobile
                </p>
                <div className="mx-auto max-w-[280px]">
                  {/* Mockup téléphone */}
                  <div className="rounded-[2rem] border-[10px] border-slate-900 bg-slate-900 shadow-xl">
                    <div className="rounded-[1.4rem] overflow-hidden bg-white">
                      {/* Status bar */}
                      <div className="bg-slate-100 px-4 py-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-700">
                        <span>14:30</span>
                        <span className="flex items-center gap-1">
                          <span>📶</span><span>🔋</span>
                        </span>
                      </div>
                      {/* Header */}
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900">SMSPro</span>
                        <span className="text-[10px] text-slate-500">maintenant</span>
                      </div>
                      {/* Message */}
                      <div className="p-3 bg-slate-50 min-h-[180px]">
                        <div className="bg-blue-500 text-white text-xs rounded-2xl rounded-tl-sm px-3 py-2 max-w-[90%] shadow-sm">
                          {previewMessage || (
                            <span className="italic text-blue-100">Votre message apparaîtra ici...</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <span>Aperçu avec un contact type</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 mb-1">
                  💡 Astuce : Un SMS standard fait 160 caractères. Au-delà, il sera envoyé en plusieurs parties ({smsCount || 1} SMS).
                </p>
                <p className="text-xs text-emerald-700">
                  📊 Les liens (URLs) sont automatiquement trackés pour mesurer le taux de lecture et de clic.
                </p>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      form.message.length > 160 ? 'bg-amber-500' : 'bg-primary-500'
                    )}
                    style={{ width: `${Math.min(100, (form.message.length / 160) * 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">Qui voulez-vous contacter ?</p>
              <div className="space-y-2">
                <label className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors',
                  form.segmentType === 'all' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'
                )}>
                  <input
                    type="radio"
                    checked={form.segmentType === 'all'}
                    onChange={() => setForm({ ...form, segmentType: 'all' })}
                    className="mt-1 text-primary-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Tous les contacts actifs</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeContacts.length} contacts ont donné leur consentement
                    </p>
                  </div>
                </label>

                <label className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors',
                  form.segmentType === 'segment' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'
                )}>
                  <input
                    type="radio"
                    checked={form.segmentType === 'segment'}
                    onChange={() => setForm({ ...form, segmentType: 'segment' })}
                    className="mt-1 text-primary-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Segment spécifique</p>
                    <p className="text-xs text-slate-500 mt-0.5 mb-2">
                      Ciblez un groupe précis de contacts
                    </p>
                    {form.segmentType === 'segment' && (
                      <Select
                        value={form.segmentId}
                        onChange={(e) => setForm({ ...form, segmentId: Number(e.target.value) })}
                        options={segments.map((s) => ({
                          value: String(s.id),
                          label: `${s.name} (${s.contact_count} contacts)`,
                        }))}
                      />
                    )}
                  </div>
                </label>

                <label className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors',
                  form.segmentType === 'custom' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'
                )}>
                  <input
                    type="radio"
                    checked={form.segmentType === 'custom'}
                    onChange={() => setForm({ ...form, segmentType: 'custom' })}
                    className="mt-1 text-primary-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Sélection manuelle</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choisissez les contacts un par un
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-primary-700 uppercase">Résumé</p>
                  <p className="text-2xl font-bold text-primary-900 mt-1">
                    {targetContacts.length} contacts ciblés
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-primary-700 uppercase">Coût estimé</p>
                  <p className="text-2xl font-bold text-primary-900 mt-1">
                    {formatCurrency(estimatedCost)}
                  </p>
                  <p className="text-[10px] text-primary-700">0.08€ / SMS</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm font-medium text-slate-700">Quand voulez-vous envoyer ?</p>
              <div className="space-y-2">
                <label className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors',
                  form.sendType === 'now' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'
                )}>
                  <input
                    type="radio"
                    checked={form.sendType === 'now'}
                    onChange={() => setForm({ ...form, sendType: 'now' })}
                    className="mt-1 text-primary-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Envoyer immédiatement</p>
                    <p className="text-xs text-slate-500 mt-0.5">La campagne part dès que vous cliquez sur Envoyer</p>
                  </div>
                </label>

                <label className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors',
                  form.sendType === 'schedule' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'
                )}>
                  <input
                    type="radio"
                    checked={form.sendType === 'schedule'}
                    onChange={() => setForm({ ...form, sendType: 'schedule' })}
                    className="mt-1 text-primary-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Planifier pour plus tard</p>
                    {form.sendType === 'schedule' && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <Input
                          type="date"
                          value={form.scheduledDate}
                          onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                        />
                        <Input
                          type="time"
                          value={form.scheduledTime}
                          onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                        />
                        <p className="col-span-2 text-[10px] text-slate-500">
                          ⏰ Fuseau horaire : Europe/Brussels (UTC+1)
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Test SMS */}
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <TestTube2 className="h-4 w-4" />
                Tester avant d'envoyer
              </p>
              <div className="flex items-end gap-2">
                <Input
                  label="Numéro de test"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+32470123456"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleSendTest} disabled={testSent}>
                  {testSent ? <><Check className="h-4 w-4" /> Envoyé</> : 'Envoyer test'}
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Un SMS test (non décompté) sera envoyé pour vérifier le rendu
              </p>
            </CardContent>
          </Card>

          {/* Récap final */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardContent className="p-6">
              <p className="text-xs font-semibold text-slate-300 uppercase mb-3">📋 Récapitulatif</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400">Campagne</p>
                  <p className="text-base font-semibold">{form.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Message</p>
                  <p className="text-sm text-slate-200">{form.message}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-700">
                  <div>
                    <p className="text-xs text-slate-400">Destinataires</p>
                    <p className="text-lg font-bold">{targetContacts.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Envoi</p>
                    <p className="text-sm font-semibold">
                      {form.sendType === 'now' ? 'Immédiat' : `${form.scheduledDate} ${form.scheduledTime}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Coût</p>
                    <p className="text-lg font-bold">{formatCurrency(estimatedCost)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/campaigns')}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            {step > 1 ? 'Précédent' : 'Annuler'}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleSaveDraft}>
              Sauvegarder brouillon
            </Button>
            {step < 3 ? (
              <Button onClick={handleNext} rightIcon={<ArrowRight className="h-4 w-4" />}>
                Suivant
              </Button>
            ) : (
              <Button
                variant="success"
                size="lg"
                onClick={handleSend}
                loading={sending}
                leftIcon={<Send className="h-4 w-4" />}
              >
                {form.sendType === 'schedule' ? 'Planifier la campagne' : 'Envoyer la campagne'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
