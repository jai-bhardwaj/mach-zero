# Deploying Mach-Zero (Free Tier)

Three free services, zero cost:

| Component | Service | Free Tier |
|-----------|---------|-----------|
| Next.js dashboard | **Vercel** | 100GB bandwidth, auto-deploy |
| PostgreSQL | **Supabase** | 500MB database, 2GB egress, auto-pauses after 7d idle |
| C++ engine + QuestDB | **Oracle Cloud** | 4 ARM cores, 24GB RAM, 200GB disk |

> **Free-tier caveat:** Supabase projects that sit idle for 7 days auto-pause; if they stay paused for ~90 days the project becomes eligible for deletion. For anything beyond personal testing either upgrade the plan or keep a lightweight cron pinging the DB.

---

## 1. Supabase PostgreSQL

1. Sign up at [supabase.com](https://supabase.com) (GitHub login)
2. **New project** → name it `mach-zero`. Pick a region close to your Vercel deployment (e.g. `ap-south-1` Mumbai if your users are in India, `us-east-1` for the US). Set a strong DB password and save it in your password manager — Supabase only shows it once.
3. Wait for the project to provision (~2 minutes), then go to **Project Settings → Database → Connection string**. You'll need both:
   - **Transaction pooler** (port 6543, Supavisor) → use for `DATABASE_URL`. Append `?pgbouncer=true` so Prisma plays nicely with the pooler. This is what runtime serverless functions on Vercel will use.
   - **Direct connection** (port 5432) → use for `DIRECT_DATABASE_URL`. Prisma migrations need a direct, non-pooled connection.

   The hostnames look like:
   - Pooled: `aws-1-<region>.pooler.supabase.com:6543`
   - Direct: `db.<project-ref>.supabase.co:5432`

4. Run migrations locally pointing to Supabase:

```bash
cd apps/web
DATABASE_URL="<pooled-url>?pgbouncer=true" \
  DIRECT_DATABASE_URL="<direct-url>" \
  npx prisma db push
DATABASE_URL="<pooled-url>?pgbouncer=true" npx tsx prisma/seed.ts
```

> If the project gets paused, the DNS for `db.<ref>.supabase.co` may resolve but connections will fail with a pool-side error; if the project has been *deleted*, DNS returns NXDOMAIN and the pooler responds with `tenant/user postgres.<ref> not found`. Either way, the Auth.js callback surfaces this as the generic "Server error" page — check Vercel logs for `AdapterError`.

---

## 2. Vercel (Next.js Dashboard)

1. Push your repo to GitHub (if not already)
2. Go to [vercel.com](https://vercel.com) → **Import Project** → select your repo
3. Configure:
   - **Root Directory**: `apps/web`
   - **Framework**: Next.js (auto-detected)
   - **Build Command**: `npx prisma generate && npm run build` (auto from vercel.json)

4. Add environment variables (copy from `.env.production.example`):
   - `DATABASE_URL` — Supabase transaction-pooler connection string (port 6543, with `?pgbouncer=true`)
   - `DIRECT_DATABASE_URL` — Supabase direct connection string (port 5432)
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

### Sync strategies from the dashboard to the engine

Strategies are created/edited in the web dashboard (Postgres). The engine reads
them from its `STRATEGIES_FILE` at startup. `apps/web/scripts/sync-strategies.ts`
bridges the two: it GETs `/api/internal/strategies` (which renders **RUNNING**
strategies as the exact `STRATEGIES_FILE` JSON) and writes the file **atomically**,
only when the content changed. A bad fetch (non-200 / network / invalid shape)
exits non-zero and **leaves the existing file untouched** — it never clobbers a
known-good config feeding the live engine.

Run it on the engine host on a timer. Env vars:

| Var | Purpose | Example |
|-----|---------|---------|
| `STRATEGIES_SYNC_URL` | the dashboard endpoint | `https://<vercel-app>/api/internal/strategies` |
| `BRIDGE_API_KEY` | shared secret (same value set in Vercel) | `…` |
| `STRATEGIES_FILE` | path the engine loads | `/opt/mach-zero/strategies.json` |

**systemd timer** (recommended — pull every 60s):

```ini
# /etc/systemd/system/mz-strategy-sync.service
[Service]
Type=oneshot
Environment=STRATEGIES_SYNC_URL=https://<vercel-app>/api/internal/strategies
Environment=BRIDGE_API_KEY=<same-as-vercel>
Environment=STRATEGIES_FILE=/opt/mach-zero/strategies.json
WorkingDirectory=/opt/mach-zero/repo/apps/web
ExecStart=/usr/bin/npm run sync:strategies

# /etc/systemd/system/mz-strategy-sync.timer
[Timer]
OnUnitActiveSec=60s
OnBootSec=30s
[Install]
WantedBy=timers.target
```

```bash
sudo systemctl enable --now mz-strategy-sync.timer
```

Or a plain cron line (`crontab -e`): `* * * * * cd /opt/mach-zero/repo/apps/web && STRATEGIES_SYNC_URL=… BRIDGE_API_KEY=… STRATEGIES_FILE=… npm run sync:strategies`.

> The engine reads `STRATEGIES_FILE` **at startup**, so a synced change applies
> on the next engine restart. Live hot-reload (engine re-reading the file without
> a restart) is a separate, unimplemented enhancement.

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
       [Supabase DB]      | aeron-driver     |
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
