# ============================================================
# Script de déploiement SMSPro — Edge Functions + Vues
# Usage : powershell -ExecutionPolicy Bypass -File deploy.ps1
# ============================================================

$ErrorActionPreference = "Stop"

$PROJECT_REF = "dnevpbdlnsfkjfywjedf"
$FUNCTIONS = @("send-campaign", "send-test-sms", "twilio-status", "twilio-incoming", "track")

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SMSPro - Déploiement Edge Functions" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Étape 1 : Vérifier la connexion Supabase ---
Write-Host "[1/4] Vérification de la connexion Supabase..." -ForegroundColor Yellow
try {
    $projects = supabase projects list --output-format json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "supabase projects list failed" }
    Write-Host "  ✅ Connecté à Supabase" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Erreur de connexion. Exécute d'abord :" -ForegroundColor Red
    Write-Host "     supabase login" -ForegroundColor White
    exit 1
}

# --- Étape 2 : Lier le projet ---
Write-Host ""
Write-Host "[2/4] Liaison au projet $PROJECT_REF..." -ForegroundColor Yellow
Write-Host "  ⚠️  Tu vas devoir entrer ton DATABASE PASSWORD" -ForegroundColor Magenta
Write-Host "  (Le trouver dans : Supabase Dashboard > Settings > Database > Password)" -ForegroundColor Gray
Write-Host ""
supabase link --project-ref $PROJECT_REF
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Échec de la liaison. Vérifie ton mot de passe." -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Projet lié" -ForegroundColor Green

# --- Étape 3 : Déployer les Edge Functions ---
Write-Host ""
Write-Host "[3/4] Déploiement des Edge Functions..." -ForegroundColor Yellow

foreach ($fn in $FUNCTIONS) {
    Write-Host "  → Déploiement de $fn..." -ForegroundColor Gray
    supabase functions deploy $fn --no-verify-jwt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Échec du déploiement de $fn" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ $fn déployée" -ForegroundColor Green
}

# --- Étape 4 : Info webhooks ---
$FUNCTION_BASE = "https://$PROJECT_REF.supabase.co/functions/v1"

Write-Host ""
Write-Host "[4/4] Configuration des webhooks Twilio..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Configure ces URLs dans Twilio Console > Phone Numbers > Ton numéro :" -ForegroundColor Cyan
Write-Host ""
Write-Host "  📩 A MESSAGE COMES IN :" -ForegroundColor White
Write-Host "     $FUNCTION_BASE/twilio-incoming" -ForegroundColor Green
Write-Host ""
Write-Host "  📬 STATUS CALLBACK URL :" -ForegroundColor White
Write-Host "     $FUNCTION_BASE/twilio-status" -ForegroundColor Green
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ✅ Déploiement terminé !" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaines étapes :" -ForegroundColor Yellow
Write-Host "  1. Va dans Twilio Console et configure les webhooks ci-dessus" -ForegroundColor White
Write-Host "  2. Active pg_cron dans Supabase Dashboard > SQL Editor :" -ForegroundColor White
Write-Host "     CREATE EXTENSION IF NOT EXISTS pg_cron;" -ForegroundColor Gray
Write-Host "  3. Teste l'envoi d'un SMS depuis l'app" -ForegroundColor White
Write-Host ""
