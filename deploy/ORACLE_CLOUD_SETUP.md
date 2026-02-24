# Oracle Cloud Deployment Guide — Aetherium Nova

This guide walks through deploying a live Aetherium Nova validator node on
**Oracle Cloud Always Free** (Ampere A1 ARM — 4 vCPU, 24 GB RAM, zero cost).

---

## Prerequisites

- Oracle Cloud account (free at cloud.oracle.com)
- Windows PC with PowerShell (for SSH key generation)
- This repository cloned locally

---

## Step 1 — Generate an SSH Key Pair (Windows)

Run the helper script from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\generate-ssh-key.ps1
```

This creates `~/.ssh/aetherium-oci` (private) and `~/.ssh/aetherium-oci.pub`
(public). **Copy the public key output** — you'll paste it into OCI next.

---

## Step 2 — Create the VM Instance in OCI Console

1. Log in at **cloud.oracle.com** → Open the **☰ menu → Compute → Instances**
2. Click **Create instance**

### Instance details

| Field | Value |
|---|---|
| Name | `aetherium-nova-node` |
| Compartment | Your root compartment |
| Availability domain | Any (pick the one with A1 capacity) |

### Image and shape

| Field | Value |
|---|---|
| Image | **Canonical Ubuntu 22.04** |
| Shape | **VM.Standard.A1.Flex** |
| OCPUs | **4** |
| Memory (GB) | **24** |

> All four A1 OCPUs and 24 GB RAM are included in the Always Free allocation.

### Networking

| Field | Value |
|---|---|
| VCN | Create new (or use existing) |
| Subnet | Public subnet |
| Assign a public IPv4 address | **Yes** |

### SSH keys

Select **Paste public keys** and paste the entire contents of
`~/.ssh/aetherium-oci.pub`.

Click **Create**. The instance will be **Running** within ~2 minutes.

---

## Step 3 — Open Firewall Ports (OCI Security List)

The VM has a public IP but OCI's Security List blocks traffic by default.

1. Go to **Networking → Virtual Cloud Networks → your VCN**
2. Click **Security Lists → Default Security List**
3. Click **Add Ingress Rules** and add:

| Stateless | Source CIDR | IP Protocol | Destination Port | Description |
|---|---|---|---|---|
| No | 0.0.0.0/0 | TCP | 3001 | Aetherium REST API |
| No | 0.0.0.0/0 | TCP | 6001 | Aetherium P2P WebSocket |

> Port 22 (SSH) is typically open by default.
> Port 80 and 443 are needed if you add a domain + TLS (recommended).

---

## Step 4 — SSH into the Instance

Find the **Public IP** on the instance detail page, then:

```powershell
ssh -i "$env:USERPROFILE\.ssh\aetherium-oci" ubuntu@<PUBLIC_IP>
```

---

## Step 5 — Run the Setup Script

Once logged in, download and run the automated setup script:

```bash
curl -fsSL https://raw.githubusercontent.com/ashrafmusa/Aetherium_Nova_v2/main/deploy/setup-oracle.sh \
  -o setup-oracle.sh

chmod +x setup-oracle.sh
sudo ./setup-oracle.sh
```

The script will:
1. Install Node.js 22, Git, Nginx
2. Open OS-level firewall ports (UFW + iptables)
3. Clone and build the repository
4. Prompt you for `API_KEY`, `MINER_ADDRESS`, and peers
5. Create a systemd service that auto-restarts on crash
6. Optionally configure Nginx + Let's Encrypt TLS

---

## Step 6 — Import Your Miner Wallet

Copy your encrypted wallet file from your local machine to the server:

```powershell
# Run on Windows
scp -i "$env:USERPROFILE\.ssh\aetherium-oci" `
  "d:\_Projects\Aetherium_Nova_v2\wallets\0xd5ee6bc2c1afcbfaa68b3273caf9d4c17f4819e0.json" `
  ubuntu@<PUBLIC_IP>:/opt/aetherium-nova/wallets/
```

Then set the miner address and password in the env file:

```bash
sudo nano /etc/aetherium-nova/.env
```

```dotenv
MINER_ADDRESS=0xd5ee6bc2c1afcbfaa68b3273caf9d4c17f4819e0
WALLET_PASSWORD=2026-02-24 02:49:24
```

Restart the service:

```bash
sudo systemctl restart aetherium-nova
```

---

## Step 7 — Verify the Node is Live

```bash
# Check service status
sudo systemctl status aetherium-nova

# Watch live logs
sudo journalctl -u aetherium-nova -f

# Query the API (replace with your key)
curl -s -H "x-api-key: YOUR_API_KEY" http://localhost:3001/status | python3 -m json.tool
```

From your Windows machine:

```powershell
Invoke-RestMethod -Uri "http://<PUBLIC_IP>:3001/status" `
  -Headers @{ "x-api-key" = "YOUR_API_KEY" }
```

Expected output:

```json
{ "height": 8, "peers": 0, "mempool": 0, "tps": 0 }
```

---

## Step 8 — Start Mining

SSH into the server:

```bash
cd /opt/aetherium-nova
export WALLET_PASSWORD="your-wallet-password"

# Mine one block
node dist/cli.js mine

# Auto-mine (runs continuously)
while true; do
  node dist/cli.js mine 2>&1 | grep -v '^\d{4}-\d{2}-\d{2}'
  sleep 5
done
```

> For production, set `WALLET_PASSWORD` in `/etc/aetherium-nova/.env` and
> add a dedicated `mine` loop to the systemd service or a separate cron job.

---

## Step 9 — (Optional) Add a Domain + HTTPS

1. Point your domain's A record to the instance public IP
2. Re-run the setup script and provide the domain name when prompted, or:

```bash
sudo certbot --nginx -d your-domain.com
```

3. Enable TLS for P2P by uncommenting in `/etc/aetherium-nova/.env`:

```dotenv
P2P_TLS_CERT=/etc/letsencrypt/live/your-domain.com/fullchain.pem
P2P_TLS_KEY=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

Then restart: `sudo systemctl restart aetherium-nova`

Other nodes can now connect via `wss://your-domain.com:6001`.

---

## Step 10 — Point the Explorer at the Live Node

In your local `aetherium-nova-explorer/.env.local`:

```dotenv
VITE_API_URL=https://your-domain.com
VITE_API_KEY=YOUR_API_KEY
```

Or using the public IP:

```dotenv
VITE_API_URL=http://<PUBLIC_IP>:3001
VITE_API_KEY=YOUR_API_KEY
```

Then redeploy the explorer:

```powershell
cd d:\_Projects\Aetherium_Nova_v2\aetherium-nova-explorer
npm run build
# Deploy dist/ to GitHub Pages or any static host
```

---

## Useful Commands (on the server)

```bash
# Live logs
sudo journalctl -u aetherium-nova -f

# Restart / stop / start
sudo systemctl restart aetherium-nova
sudo systemctl stop aetherium-nova
sudo systemctl start aetherium-nova

# Check balances
cd /opt/aetherium-nova
node dist/cli.js status
node dist/cli.js get-balance 0xYOUR_ADDRESS

# Pull latest code and rebuild
sudo bash /opt/aetherium-nova/deploy/update.sh

# Backup wallets
sudo tar -czf wallets-backup-$(date +%Y%m%d).tar.gz /opt/aetherium-nova/wallets/
```

---

## Free Tier Limits

| Resource | Always Free Allocation | Usage |
|---|---|---|
| Compute | 4 A1 OCPUs, 24 GB RAM | ~1 OCPU, ~512 MB RAM at idle |
| Block storage | 200 GB total | 50 GB OS + 50 GB chain data |
| Outbound data | 10 TB/month | P2P traffic (minimal on testnet) |
| **Cost** | **$0.00/month forever** | |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Port 3001 refused from outside | Add OCI Security List ingress rule for TCP 3001 |
| Service crashes on start | `journalctl -u aetherium-nova -n 50` — check for missing env vars |
| `Cannot find module 'dist/node.js'` | Run `npm run build` in `/opt/aetherium-nova` |
| SSH connection refused | Verify the public key was pasted correctly; check Security List port 22 |
| Node stuck at old height | Delete `/opt/aetherium-nova/data/chain-db/` and restart to resync |
