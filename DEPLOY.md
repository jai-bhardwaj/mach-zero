# Deploying Mach-Zero (Free Tier)

Three free services, zero cost:

| Component | Service | Free Tier |
|-----------|---------|-----------|
| Next.js dashboard | **Vercel** | 100GB bandwidth, auto-deploy |
| PostgreSQL | **Neon** | 0.5GB storage, serverless |
| C++ engine + QuestDB | **Oracle Cloud** | 4 ARM cores, 24GB RAM, 200GB disk |

---

## 1. Neon PostgreSQL

1. Sign up at [neon.tech](https://neon.tech) (GitHub login)
2. Create a project named `mach-zero`
3. Copy the connection strings from **Connection Details**:
   - **Pooled** connection → `DATABASE_URL`
   - **Direct** connection → `DIRECT_DATABASE_URL`

4. Run migrations locally pointing to Neon:

```bash
cd apps/web
DATABASE_URL="your-pooled-url" DIRECT_DATABASE_URL="your-direct-url" npx prisma db push
DATABASE_URL="your-pooled-url" npx tsx prisma/seed.ts
```

---

## 2. Vercel (Next.js Dashboard)

1. Push your repo to GitHub (if not already)
2. Go to [vercel.com](https://vercel.com) → **Import Project** → select your repo
3. Configure:
   - **Root Directory**: `apps/web`
   - **Framework**: Next.js (auto-detected)
   - **Build Command**: `npx prisma generate && npm run build` (auto from vercel.json)

4. Add environment variables (copy from `.env.production.example`):
   - `DATABASE_URL` — Neon pooled connection string
   - `DIRECT_DATABASE_URL` — Neon direct connection string
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your Vercel URL (e.g., `https://mach-zero.vercel.app`)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
   - `SUPER_ADMIN_EMAILS` — your email
   - `EMAIL_SERVER` / `EMAIL_FROM` — SMTP credentials
   - `QUESTDB_URL`, `BRIDGE_HTTP_URL`, `KILL_SWITCH_URL` — Oracle VM IP
   - `NEXT_PUBLIC_BRIDGE_WS_URL` — Oracle VM WebSocket URL

5. **Google OAuth**: Add your Vercel URL to authorized redirect URIs:
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```

6. Deploy! Vercel auto-deploys on every push to `main`.

---

## 3. Oracle Cloud Always Free VM (C++ Engine)

### Create the VM

1. Sign up at [cloud.oracle.com](https://cloud.oracle.com) (credit card required for verification, never charged)
2. Go to **Compute** → **Create Instance**:
   - **Shape**: VM.Standard.A1.Flex (Ampere ARM)
   - **OCPUs**: 4, **Memory**: 24 GB
   - **Image**: Ubuntu 22.04 Minimal (aarch64)
   - **Boot volume**: 100 GB (free up to 200 GB)
   - **Add SSH key**: paste your `~/.ssh/id_rsa.pub`
3. Note the **Public IP address**

### Oracle Cloud Network Rules

In the Oracle Cloud Console, you must open ports in the **Security List** (not just iptables):

1. Go to **Networking** → **Virtual Cloud Networks** → your VCN → **Security Lists**
2. Add **Ingress Rules**:
   - Port 22 (SSH) — already open by default
   - Port 3002 (Python bridge WebSocket) — Source: `0.0.0.0/0`

> QuestDB (9000) and risk-monitor (8080) bind to `127.0.0.1` only in the production compose file — they're not exposed externally.

### Setup the VM

```bash
# From your local machine:
ssh ubuntu@<VM_IP> 'bash -s' < infra/setup-oracle-vm.sh
```

### Deploy the C++ stack

```bash
ssh ubuntu@<VM_IP>
cd ~/mach-zero
git clone https://github.com/YOUR_USERNAME/mach-zero.git .

# Build and start all services
cd infra
docker compose -f docker-compose.prod.yml up -d --build

# Verify
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### Initialize QuestDB tables

```bash
# SSH into the VM, then:
docker exec -i mz-questdb bash -c "curl -G 'http://localhost:9000/exec' --data-urlencode 'query=$(cat /dev/stdin)'" < infra/schema/questdb_tables.sql
```

---

## 4. GitHub Actions (Auto-Deploy)

Add these secrets in GitHub → Settings → Secrets and Variables → Actions:

| Secret | Value |
|--------|-------|
| `ORACLE_VM_HOST` | Your Oracle VM public IP |
| `ORACLE_VM_USER` | `ubuntu` |
| `ORACLE_VM_SSH_KEY` | Contents of your SSH private key |

Vercel deploys automatically via GitHub integration (no secrets needed).

On every push to `main`:
1. CI runs C++ tests and web tests
2. If tests pass → Vercel auto-deploys the web app
3. If tests pass → GitHub Actions SSHs into Oracle VM and rebuilds containers

---

## Architecture Diagram

```
                    Internet
                       |
            +---------+---------+
            |                   |
       [Vercel]           [Oracle Cloud VM]
       Next.js app        +-----------------+
       (free tier)        | Docker Compose   |
            |             |                  |
       [Neon DB]          | aeron-driver     |
       PostgreSQL         | gateway (Binance)|
       (free tier)        | engine           |
                          | risk-monitor     |
                          | persistence      |
                          | QuestDB          |
                          +-----------------+
```

---

## Useful Commands

```bash
# View engine logs
ssh ubuntu@<VM_IP> 'cd ~/mach-zero/infra && docker compose -f docker-compose.prod.yml logs engine -f'

# Restart a single service
ssh ubuntu@<VM_IP> 'cd ~/mach-zero/infra && docker compose -f docker-compose.prod.yml restart engine'

# Start with mock exchange for paper trading
ssh ubuntu@<VM_IP> 'cd ~/mach-zero/infra && docker compose -f docker-compose.prod.yml --profile mock up -d'

# Check QuestDB console (SSH tunnel)
ssh -L 9000:localhost:9000 ubuntu@<VM_IP>
# Then open http://localhost:9000 in your browser
```
