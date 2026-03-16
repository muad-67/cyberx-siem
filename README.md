# CyberX — Lightweight SIEM

> **Flask · React · SQLite · MITRE ATT&CK**
> Real-time threat detection, alert triage, endpoint monitoring, and SOC investigation workspace.

---

## What You Need Before Starting

| Tool | Version | Check |
|---|---|---|
| Python | 3.9 or newer | `python --version` |
| Node.js | 18 or newer | `node --version` |
| npm | 9 or newer | `npm --version` |
| Git (optional) | any | — |

> **Windows users:** always use **PowerShell** or **CMD** — not WSL — when running the backend and scripts. WSL has a separate network stack and `127.0.0.1` won't reach a server running on Windows.

---

## Step 1 — Start the Backend (Flask API)

Open **PowerShell** and run:

```powershell
cd C:\Users\mohadeq\Desktop\Siem_tool\siem_server

python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt

python app.py
```

**What you should see:**

```
[DB] Schema initialized.
[DB] Schema up to date.
[DB] Default users created: mohadek (admin), sabrin (analyst)
[RETENTION] Background retention worker started.
======================================================
  CyberX Lightweight SIEM — SOC Server
======================================================
  Listening on http://0.0.0.0:5000
======================================================
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.0.103:5000
```

> Leave this terminal open. The server must stay running.

---

## Step 2 — Start the Dashboard (React)

Open a **second PowerShell window** and run:

```powershell
cd C:\Users\mohadeq\Desktop\Siem_tool\siem_dashboard

npm install

npm start
```

**What you should see:**

```
Compiled successfully!

  Local:            http://localhost:3000
  On Your Network:  http://192.168.0.103:3000
```

Your browser opens automatically at `http://localhost:3000`.

> Leave this terminal open too.

---

## Step 3 — Log In

The dashboard will show a login page.

| Username | Password | Role |
|---|---|---|
| `mohadek` | `mohadek123` | Admin |
| `sabrin` | `mohadek123` | Analyst |

These accounts are created automatically on first server startup.

---

## Step 4 — Run the Windows Agent (optional)

The agent reads your Windows Event Log and ships events to the SIEM in real time.

Open a **third PowerShell window** (as Administrator for Security log access):

```powershell
cd C:\Users\mohadeq\Desktop\Siem_tool\siem_agent

pip install -r requirements_windows.txt

python windows_agent.py
```

**What you should see:**

```
[AGENT] Searching for SIEM server...
[AGENT] Found SIEM at http://127.0.0.1:5000
======================================================
  CyberX Windows Log Agent
======================================================
  SIEM Server : http://127.0.0.1:5000/api/logs
  Source IP   : 192.168.0.103
  Hostname    : DESKTOP-2C97LV3
  Poll every  : 10s
======================================================
  Starting... (Ctrl+C to stop)
[AGENT] Shipped 12 Windows events to http://127.0.0.1:5000/api/logs
```

The agent auto-detects the SIEM server — no IP configuration needed.

> You do **not** need to run the agent to use the dashboard. You can send test logs manually in Step 5.

---

## Step 5 — Send Test Logs (Simulate Attacks)

Open a **PowerShell window** (not WSL) and run:

```powershell
cd C:\Users\mohadeq\Desktop\Siem_tool

python scripts\simulate_attack.py
```

This fires 6 attack scenarios:

| # | Attack | Rule | MITRE | Expected Alert |
|---|---|---|---|---|
| 1 | SSH Brute Force (8 failed logins) | R001 | T1110 | `brute_force` CRITICAL |
| 2 | Root login | R003 | T1548 | `privilege_escalation` HIGH |
| 3 | Backdoor account created | R004 | T1136 | `persistence` HIGH |
| 4 | Port scan (15 attempts) | R006 | T1046 | `port_scan` MEDIUM |
| 5 | Sudo command | R005 | T1548 | `privilege_escalation` MEDIUM |
| 6 | Successful login after failures | R002 | T1078 | `suspicious_login` CRITICAL |

After running, go to the **Alerts** tab in the dashboard — you should see new alerts appear.

---

## Step 6 — Explore the Dashboard

| Tab | What to do |
|---|---|
| **Overview** | See live counters — logs received, open alerts, blocked IPs |
| **Alerts** | Click an alert → Investigate → Resolve. Click "Timeline" to see the attacker's full story |
| **Log Feed** | Use the search bar to filter by keyword, date range, or hostname |
| **Analytics** | See which attack types are most common, top attacking IPs, log volume chart |
| **MITRE ATT&CK** | Coloured tiles = techniques observed. Click any tile → official MITRE page |
| **Response** | Block an IP, add to watchlist, add to whitelist |
| **Reports** | Download daily/weekly summaries as CSV or JSON |
| **Endpoints** | See health status of all machines that have sent logs (online/stale/offline) |
| **Timeline** | Type any IP → see every log and alert from that IP in chronological order |
| **Investigations** | Create notes, set priority, tag incidents, track resolution |

---

## Verify the Server is Running

At any time, open your browser or run:

```powershell
curl http://127.0.0.1:5000/api/health
```

Expected response:

```json
{"service": "CyberX SIEM", "status": "ok"}
```

---

## Send a Single Test Log Manually

```powershell
curl -X POST http://127.0.0.1:5000/api/logs `
  -H "Content-Type: application/json" `
  -d '{\"source_ip\":\"192.168.1.30\",\"log_type\":\"auth\",\"message\":\"Failed password for root from 192.168.1.30 port 22 ssh2\",\"hostname\":\"test-vm\"}'
```

Send the same command 5+ times quickly — a `brute_force` alert will appear in the Alerts tab.

---

## Threat Intelligence (Optional)

Get a free API key at [abuseipdb.com](https://www.abuseipdb.com) (1,000 checks/day free), then:

```powershell
$env:ABUSEIPDB_KEY="your_key_here"
python app.py
```

Once set, the **"Check Reputation"** button on each alert will show the IP's abuse score and whether it is a known malicious host.

---

## Stopping Everything

| What | How |
|---|---|
| Flask server | `Ctrl+C` in its terminal |
| React dashboard | `Ctrl+C` in its terminal |
| Windows agent | `Ctrl+C` in its terminal |

---

## Restarting After a Reboot

```powershell
# Terminal 1 — Backend
cd C:\Users\mohadeq\Desktop\Siem_tool\siem_server
venv\Scripts\activate
python app.py

# Terminal 2 — Dashboard
cd C:\Users\mohadeq\Desktop\Siem_tool\siem_dashboard
npm start

# Terminal 3 — Agent (optional, run as Administrator)
cd C:\Users\mohadeq\Desktop\Siem_tool\siem_agent
python windows_agent.py
```

> `npm install` only needs to run once. After that, `npm start` is enough.
> The `venv\Scripts\activate` must be run every time you open a new terminal for the backend.

---

## Troubleshooting

### "No module named flask"
The virtual environment is not activated.
```powershell
venv\Scripts\activate
```

### "no such column: risk_score"
Your database is from an older version. Delete it and restart — it will be recreated:
```powershell
del siem_server\siem.db
python siem_server\app.py
```

### Dashboard shows "Connecting…" and no data loads
The Flask server is not running. Start it first (Step 1), then refresh the browser.

### Simulate script says "Connection refused"
You are running it from WSL. Use PowerShell instead, or pass the Windows host IP:
```bash
python scripts/simulate_attack.py --url http://172.22.208.1:5000/api/logs
```

### Agent says "Could not read Security log"
Run PowerShell as Administrator — the Windows Security Event Log requires elevated access.

---

---

## VM Lab — Linux Endpoint Testing

Your setup: **SIEM runs on Windows. One Linux VM sends real logs to it.**
You watch everything in your Windows browser at `http://localhost:3000`.

```
┌──────────────────────────────────────────────────────────────┐
│                 Host-Only Network: 192.168.56.0/24            │
│                                                              │
│  ┌────────────────────────────┐      ┌─────────────────────┐ │
│  │  Your Windows PC (Host)    │      │  Linux VM           │ │
│  │                            │      │  Ubuntu 22.04       │ │
│  │  Flask backend  :5000  ◄───┼──────┤  192.168.56.20      │ │
│  │  React dashboard :3000     │      │  agent.py           │ │
│  │  192.168.56.1 (Host-Only)  │      │  /var/log/auth.log  │ │
│  │  192.168.0.103 (Wi-Fi)     │      │  /var/log/syslog    │ │
│  └────────────────────────────┘      └─────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

### A. VirtualBox Network Setup (do this once)

1. Open **VirtualBox → Tools → Network Manager**
2. Click **Create**
3. Set:
   - IPv4 Address: `192.168.56.1`
   - Subnet Mask: `255.255.255.0`
   - DHCP Server: **Disabled**
4. Click **Apply / OK**

This creates a private network between Windows and your VMs.
Windows gets `192.168.56.1` on that network automatically.

---

### B. Linux VM — Network Adapters

In VirtualBox, select your Ubuntu VM → **Settings → Network**:

| Adapter | Type | Purpose |
|---|---|---|
| Adapter 1 | Host-only → `vboxnet0` | Talk to Windows SIEM |
| Adapter 2 | NAT | Internet access for `apt install` |

---

### C. Linux VM — First Boot Setup

Boot the VM and open a terminal.

#### Set a static IP on the Host-Only interface

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

Replace with:

```yaml
network:
  version: 2
  ethernets:
    enp0s3:
      addresses: [192.168.56.20/24]
    enp0s8:
      dhcp4: true
```

```bash
sudo netplan apply
ip addr show enp0s3
# should show 192.168.56.20
```

> If your adapter names differ, check them with `ip link` and update accordingly.

#### Test connectivity to Windows

```bash
ping 192.168.56.1
curl http://192.168.56.1:5000/api/health
```

Expected:
```json
{"service": "CyberX SIEM", "status": "ok"}
```

If `curl` fails, go to **Part D** (Windows Firewall) first.

---

### D. Allow Port 5000 Through Windows Firewall (do this once)

On Windows, open **PowerShell as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "CyberX SIEM" `
  -Direction Inbound -Protocol TCP -LocalPort 5000 `
  -Action Allow
```

Then re-run the `curl` from the Linux VM — it should now succeed.

---

### E. Install and Run the Agent on the Linux VM

```bash
sudo apt update
sudo apt install -y python3 python3-pip openssh-server
pip3 install requests
```

Copy the agent from Windows to the VM:

```bash
scp mohadeq@192.168.56.1:"C:/Users/mohadeq/Desktop/Siem_tool/siem_agent/agent.py" ~/agent.py
```

Or download it manually — open `siem_agent/agent.py` on Windows, copy the text, then on the VM:

```bash
nano ~/agent.py   # paste and save
```

#### Configure the agent

Open `agent.py` and set these two lines:

```python
SIEM_URL  = "http://192.168.56.1:5000/api/logs"   # Windows Host-Only IP
SOURCE_IP = "192.168.56.20"                         # This VM's IP
```

#### Run the agent

```bash
sudo python3 agent.py
```

Expected output:

```
======================================================
  CyberX SIEM Agent
  Hostname : ubuntu-vm
  Source IP: 192.168.56.20
  SIEM URL : http://192.168.56.1:5000/api/logs
  Watching : ['/var/log/auth.log', '/var/log/syslog', '/var/log/kern.log']
======================================================
```

> Keep this running. It polls every 5 seconds for new log lines.

Now go to the **Log Feed** tab on your Windows dashboard — you should already see syslog entries arriving from `192.168.56.20`.

---

### F. Generate Real Attacks from the Linux VM

Run these on the Linux VM and watch alerts appear on your Windows dashboard in real time.

---

#### Attack 1 — SSH Brute Force → brute_force CRITICAL (T1110)

```bash
# Install hydra if needed
sudo apt install -y hydra

hydra -l root -P /usr/share/wordlists/rockyou.txt \
      ssh://192.168.56.20 -t 4 -f -V
```

No wordlist? Use this quick version instead:

```bash
for i in {1..8}; do
  ssh -o StrictHostKeyChecking=no -o ConnectTimeout=2 wronguser@192.168.56.20 2>/dev/null || true
done
```

**What to see on dashboard:**
- Log Feed: `Failed password for root` lines streaming in
- Alerts tab: `brute_force` CRITICAL card with `SRC: 192.168.56.20` and MITRE T1110 badge

---

#### Attack 2 — Successful Login After Failures → suspicious_login CRITICAL (T1078)

After the brute force, log in successfully:

```bash
ssh your_user@192.168.56.20
```

**What to see on dashboard:**
- Alerts tab: `suspicious_login` CRITICAL — same IP had failures then success
- Investigations tab: correlation engine may auto-create an incident grouping both alerts

---

#### Attack 3 — Port Scan → port_scan MEDIUM (T1046)

```bash
sudo apt install -y nmap
nmap -sS -p 1-1000 192.168.56.20
```

**What to see on dashboard:**
- Alerts tab: `port_scan` MEDIUM with MITRE T1046

---

#### Attack 4 — Create Backdoor Account → persistence HIGH (T1136)

```bash
sudo useradd -m backdoor
echo "backdoor:pass123" | sudo chpasswd
```

**What to see on dashboard:**
- Alerts tab: `persistence` HIGH — MITRE T1136 Create Accounts

---

#### Attack 5 — Privilege Escalation → privilege_escalation MEDIUM (T1548)

```bash
sudo cat /etc/shadow
```

**What to see on dashboard:**
- Alerts tab: `privilege_escalation` MEDIUM — MITRE T1548

---

#### Attack 6 — Root Login → privilege_escalation HIGH (T1548)

```bash
sudo su -
```

**What to see on dashboard:**
- Alerts tab: `privilege_escalation` HIGH — root session opened

---

### G. Full Dashboard Walkthrough After Attacks

| Tab | What you should see |
|---|---|
| **Overview** | Logs: 50+, Open Alerts: 6+, Endpoint `ubuntu-vm` listed as Online |
| **Alerts** | 6 alert cards — each with severity badge, MITRE tag, source IP `192.168.56.20` |
| **Log Feed** | Live stream of every auth.log and syslog line from the VM |
| **Analytics** | `192.168.56.20` as top attacking IP; brute_force dominates the bar chart |
| **MITRE ATT&CK** | T1110, T1078, T1046, T1136, T1548 tiles lit up in red/orange/yellow |
| **Endpoints** | Row: `ubuntu-vm · 192.168.56.20 · Online · log count rising` |
| **Timeline** | Enter `192.168.56.20` → see every event in order: scan → brute force → login → escalation |
| **Response** | Click Block on any alert → `192.168.56.20` added to blocked list |
| **Investigations** | Open the auto-created incident → add notes → set priority Critical → resolve |

---

### H. Quick Cheatsheet — Daily Lab Session

**Windows (PowerShell) — start these first:**

```powershell
# Terminal 1 — Backend
cd C:\Users\mohadeq\Desktop\Siem_tool\siem_server
venv\Scripts\activate
python app.py

# Terminal 2 — Dashboard
cd C:\Users\mohadeq\Desktop\Siem_tool\siem_dashboard
npm start
```

**Linux VM — after Windows is running:**

```bash
sudo python3 ~/agent.py
```

**Open browser on Windows:** `http://localhost:3000`

**Attack from the VM:**

```bash
for i in {1..8}; do ssh -o StrictHostKeyChecking=no wronguser@192.168.56.20 2>/dev/null || true; done
sudo useradd testuser && sudo cat /etc/shadow
```

Watch the alerts appear live.

---

### I. VM Troubleshooting

| Problem | Fix |
|---|---|
| `curl 192.168.56.1:5000` times out | Run the firewall rule in Part D |
| VM can't reach `192.168.56.1` | Check Adapter 1 is Host-only in VirtualBox settings |
| `ip addr` shows no address on `enp0s3` | Run `sudo netplan apply` again; check adapter name with `ip link` |
| Agent says `Connection refused` | Flask is not running on Windows — start Step 1 first |
| `/var/log/auth.log` is empty | Enable SSH: `sudo systemctl start ssh`, then try failed logins |
| Agent needs `sudo` but you forgot | Without `sudo`, auth.log is unreadable — always run `sudo python3 agent.py` |
| `scp` from Windows to VM fails | Enable SSH on the VM: `sudo apt install openssh-server && sudo systemctl start ssh` |

---

*CyberX Lightweight SIEM · Final Year Project · Flask · React · SQLite · MITRE ATT&CK*
