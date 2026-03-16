"""
engine/rules.py
Detection rule definitions.

Each rule is a dictionary describing:
  - which log_type to inspect
  - which keywords to match in the message
  - threshold: how many matches within the window trigger an alert
  - window: time window in seconds
  - severity and MITRE alert_type for the generated alert

Add new rules here without touching the detection engine logic.
"""

RULES = [

    # ── Rule 1: SSH Brute Force ──────────────────────────────────────────
    # 5+ failed login messages from the same IP within 60 seconds
    {
        "id":         "R001",
        "name":       "SSH Brute Force",
        "log_type":   "auth",
        "keywords":   [
            "Failed password",
            "Invalid user",
            "authentication failure",
            "FAILED LOGIN",
        ],
        "threshold":  5,
        "window":     60,
        "severity":   "critical",
        "alert_type": "brute_force",
    },

    # ── Rule 2: Successful Login After Failures ──────────────────────────
    # A successful login from an IP that had recent failures = compromise risk
    {
        "id":         "R002",
        "name":       "Login Succeeded After Failures",
        "log_type":   "auth",
        "keywords":   ["Accepted password", "Accepted publickey", "session opened"],
        "threshold":  1,
        "window":     300,
        "severity":   "critical",
        "alert_type": "suspicious_login",
    },

    # ── Rule 3: Direct Root Login ────────────────────────────────────────
    {
        "id":         "R003",
        "name":       "Root Login Detected",
        "log_type":   "auth",
        "keywords":   [
            "session opened for user root",
            "Accepted password for root",
        ],
        "threshold":  1,
        "window":     3600,
        "severity":   "high",
        "alert_type": "privilege_escalation",
    },

    # ── Rule 4: New User Account Created ────────────────────────────────
    # Attackers create backdoor accounts after gaining access
    {
        "id":         "R004",
        "name":       "New User Account Created",
        "log_type":   "auth",
        "keywords":   ["new user:", "useradd", "adduser"],
        "threshold":  1,
        "window":     3600,
        "severity":   "high",
        "alert_type": "persistence",
    },

    # ── Rule 5: Sudo Execution ───────────────────────────────────────────
    {
        "id":         "R005",
        "name":       "Sudo Command Executed",
        "log_type":   "auth",
        "keywords":   ["sudo:", "COMMAND="],
        "threshold":  1,
        "window":     60,
        "severity":   "medium",
        "alert_type": "privilege_escalation",
    },

    # ── Rule 6: Port Scan ────────────────────────────────────────────────
    # Many connection attempts from the same IP = port scan
    {
        "id":         "R006",
        "name":       "Port Scan Detected",
        "log_type":   "network",
        "keywords":   ["connection attempt", "SYN", "refused", "CONNECT", "scan"],
        "threshold":  10,
        "window":     30,
        "severity":   "medium",
        "alert_type": "port_scan",
    },

    # ── Rule 7: Off-Hours Login ──────────────────────────────────────────
    # Logins between midnight and 6am are unusual for SMEs
    {
        "id":         "R007",
        "name":       "Off-Hours Login (00:00–06:00)",
        "log_type":   "auth",
        "keywords":   ["Accepted password", "session opened"],
        "threshold":  1,
        "window":     3600,
        "severity":   "medium",
        "alert_type": "anomalous_behavior",
        "time_condition": {"start_hour": 0, "end_hour": 6},
    },

    # ── Rule 8: Windows Failed Login ────────────────────────────────────
    # Windows Security Event ID 4625 — failed logon attempts
    {
        "id":         "R008",
        "name":       "Windows Brute Force (Event 4625)",
        "log_type":   "windows",
        "keywords":   [
            "EventID:4625",
            "4625",
            "Logon Failure",
            "An account failed to log on",
        ],
        "threshold":  5,
        "window":     60,
        "severity":   "critical",
        "alert_type": "brute_force",
    },

    # ── Rule 9: Windows Admin Login ─────────────────────────────────────
    # Windows Event ID 4672 — special privileges assigned (admin equivalent)
    {
        "id":         "R009",
        "name":       "Windows Admin Privilege Login (Event 4672)",
        "log_type":   "windows",
        "keywords":   [
            "EventID:4672",
            "4672",
            "Special privileges",
            "SeDebugPrivilege",
            "SeTcbPrivilege",
        ],
        "threshold":  1,
        "window":     3600,
        "severity":   "high",
        "alert_type": "suspicious_login",
    },

    # ── Rule 10: HTTP Brute Force ────────────────────────────────────────
    # Many HTTP 401/403 responses from the same IP = credential stuffing
    {
        "id":         "R010",
        "name":       "HTTP Brute Force (401/403 Flood)",
        "log_type":   "web",
        "keywords":   [
            "HTTP/1.1\" 401",
            "HTTP/1.1\" 403",
            " 401 ",
            " 403 ",
            "Unauthorized",
            "Forbidden",
        ],
        "threshold":  20,
        "window":     60,
        "severity":   "high",
        "alert_type": "brute_force",
    },

    # ── Rule 11: SQL Injection Attempt ───────────────────────────────────
    # Classic SQLi patterns in web request logs
    {
        "id":         "R011",
        "name":       "SQL Injection Attempt",
        "log_type":   "web",
        "keywords":   [
            "UNION SELECT",
            "union select",
            "' OR '1'='1",
            "1=1--",
            "DROP TABLE",
            "xp_cmdshell",
            "SLEEP(",
            "BENCHMARK(",
            "' OR 1=1",
        ],
        "threshold":  3,
        "window":     10,
        "severity":   "critical",
        "alert_type": "web_attack",
    },

    # ── Rule 12: Malware C2 Beacon ───────────────────────────────────────
    # Repeated periodic outbound connections to the same external IP
    {
        "id":         "R012",
        "name":       "Possible C2 Beacon (Periodic Outbound)",
        "log_type":   "network",
        "keywords":   [
            "ESTABLISHED",
            "outbound",
            "beacon",
            "C2",
            "connect",
        ],
        "threshold":  5,
        "window":     300,
        "severity":   "high",
        "alert_type": "c2_communication",
    },

    # ── Rule 13: Log Clearing Detected ──────────────────────────────────
    # Attackers clear logs to hide their tracks (T1070)
    {
        "id":         "R013",
        "name":       "Security Log Cleared (Anti-Forensics)",
        "log_type":   "system",
        "keywords":   [
            "log file was cleared",
            "EventID:1102",
            "EventID:104",
            "audit log cleared",
            "logrotate",
            "truncate",
            "> /var/log",
        ],
        "threshold":  1,
        "window":     3600,
        "severity":   "critical",
        "alert_type": "log_tampering",
    },

    # ── Rule 14: Reverse Shell Pattern ──────────────────────────────────
    # Common reverse shell indicators in logs or command output
    {
        "id":         "R014",
        "name":       "Reverse Shell Detected",
        "log_type":   "network",
        "keywords":   [
            "/bin/bash -i",
            "bash -i >& /dev/tcp",
            "nc -e /bin/bash",
            "ncat",
            "python -c 'import socket",
            "reverse shell",
            "mkfifo",
        ],
        "threshold":  1,
        "window":     60,
        "severity":   "critical",
        "alert_type": "reverse_shell",
    },

    # ── Rule 15: Lateral Movement (Multi-Host Login) ─────────────────────
    # Same source IP authenticating to multiple different hostnames
    {
        "id":         "R015",
        "name":       "Lateral Movement — Multiple Host Logins",
        "log_type":   "auth",
        "keywords":   ["Accepted password", "Accepted publickey", "session opened"],
        "threshold":  3,
        "window":     300,
        "severity":   "high",
        "alert_type": "lateral_movement",
    },
]
