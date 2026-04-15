# Guia: Associar a App a um Domínio (Cloudflare Tunnel)

Este guia explica como tornar o teu executável local acessível via internet (ex: `admin.teudominio.com`) de forma segura, sem precisar de abrir portas no router da empresa.

## 1. Requisitos Prévios
- Ter um domínio registado (pode ser na Cloudflare ou noutro lado, mas deve estar gerido pela Cloudflare).
- Ter o executável `AutoParts.exe` a correr no PC (Porto 8000).

---

## 2. Passo-a-Passo (Via Dashboard Cloudflare)

A forma mais fácil de configurar é através do **Cloudflare Zero Trust**:

### A. Criar o Túnel
1. Acede ao dashboard da [Cloudflare Zero Trust](https://one.dash.cloudflare.com/).
2. Vai a **Networks** -> **Tunnels**.
3. Clica em **Create a Tunnel**.
4. Dá um nome ao túnel (ex: `AutoParts-Empresa`) e guarda.

### B. Instalar o Cloudflared no PC
1. No dashboard, seleciona **Windows**.
2. Ele vai dar-te um comando de instalação (normalmente começa com `msiexec /i ...`).
3. **Copia esse comando** e corre-o na PowerShell do Windows (com permissões de Administrador).
4. O estado do túnel no dashboard mudará para **Healthy** (Verde).

### C. Configurar a Rota (Public Hostname)
1. No dashboard do túnel, clica no separador **Public Hostname**.
2. Clica em **Add a public hostname**.
3. Preenche os dados:
   - **Subdomain**: (ex: `admin` ou `pecas`)
   - **Domain**: (seleciona o teu domínio na lista)
   - **Service Type**: `HTTP`
   - **URL**: `localhost:8000`
4. Clica em **Save hostname**.

---

## 3. Configurar a Segurança (CORS)

Para que o browser não bloqueie as chamadas da tua app no novo domínio, precisamos de avisar o servidor.

1. Abre o teu ficheiro `.env` no PC.
2. Procura a variável `ALLOWED_ORIGINS`.
3. Adiciona o teu novo domínio (com `https://`):
   ```env
   ALLOWED_ORIGINS=http://localhost:8000,https://admin.teudominio.com
   ```
4. Reinicia o executável (fecha e abre novamente).

---

## 4. Porquê usar Cloudflare Tunnel?
- **Sem Port Forwarding**: Não precisas de mexer nas configurações de segurança do router da empresa.
- **HTTPS Automático**: A Cloudflare oferece o certificado SSL grátis para o teu domínio.
- **Firewall Gratuita**: Podes adicionar regras de segurança no dashboard da Cloudflare para bloquear ataques.

> [!TIP]
> Podes usar o **Cloudflare Access** (também gratuito no Zero Trust) para adicionar uma página de login extra da Cloudflare (ex: login com Código via Email) antes de alguém chegar à tua app, aumentando a segurança.
