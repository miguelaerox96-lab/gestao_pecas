# deploy.ps1 — Deploy AutoParts para Oracle Cloud
# Uso: .\deploy.ps1
#      .\deploy.ps1 -Message "Descricao da mudanca"
param(
    [string]$Message = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

# =====================================================
# CONFIGURACAO — substituir apos criar o servidor
# =====================================================
$VPS_IP     = "SUBSTITUIR_PELO_IP_ORACLE"
$VPS_USER   = "ubuntu"
$SSH_KEY    = "C:\Users\Miguel\.ssh\oracle_key.pem"
$REMOTE_DIR = "/opt/autoparts"
# =====================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AutoParts Deploy -> Oracle Cloud" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Mensagem: $Message" -ForegroundColor Gray
Write-Host ""

# 1. Push para GitHub
Write-Host "[1/3] Push para GitHub..." -ForegroundColor Yellow
git add .
$commitResult = git commit -m $Message 2>&1
if ($commitResult -match "nothing to commit") {
    Write-Host "  Sem alteracoes para commitar, a continuar deploy..." -ForegroundColor Gray
} else {
    Write-Host "  Commit feito." -ForegroundColor Gray
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERRO no git push! Verifica a ligacao ao GitHub." -ForegroundColor Red
        exit 1
    }
}

# 2. Deploy no servidor Oracle
Write-Host ""
Write-Host "[2/3] A atualizar servidor Oracle..." -ForegroundColor Yellow

$remote_cmd = "cd $REMOTE_DIR && git pull origin main && docker compose up -d --build && docker image prune -f && echo 'DEPLOY_OK'"

$result = ssh -i $SSH_KEY "${VPS_USER}@${VPS_IP}" $remote_cmd

if ($result -match "DEPLOY_OK") {
    Write-Host "  Servidor atualizado com sucesso." -ForegroundColor Gray
} else {
    Write-Host "  AVISO: Resposta inesperada do servidor." -ForegroundColor Red
    Write-Host $result
}

# 3. Verificar saude da app
Write-Host ""
Write-Host "[3/3] A verificar app..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

try {
    $response = Invoke-WebRequest -Uri "http://${VPS_IP}:8000/" -TimeoutSec 15 -ErrorAction Stop
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  DEPLOY BEM SUCEDIDO!" -ForegroundColor Green
    Write-Host "  App online: http://${VPS_IP}:8000" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ATENCAO: App pode nao estar a responder." -ForegroundColor Red
    Write-Host "Verifica os logs com:" -ForegroundColor Yellow
    Write-Host "  ssh -i $SSH_KEY ${VPS_USER}@${VPS_IP} 'docker compose -f $REMOTE_DIR/docker-compose.yml logs --tail=30'" -ForegroundColor Gray
}

Write-Host ""
