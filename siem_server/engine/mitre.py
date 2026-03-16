"""
engine/mitre.py
MITRE ATT&CK framework mappings.

Each alert_type maps to a tactic, technique ID, and technique name.
Reference: https://attack.mitre.org/
"""

MITRE_MAPPINGS = {

    "brute_force": {
        "tactic":    "Credential Access",
        "technique": "T1110",
        "name":      "Brute Force",
        "url":       "https://attack.mitre.org/techniques/T1110/",
    },

    "suspicious_login": {
        "tactic":    "Initial Access",
        "technique": "T1078",
        "name":      "Valid Accounts",
        "url":       "https://attack.mitre.org/techniques/T1078/",
    },

    "privilege_escalation": {
        "tactic":    "Privilege Escalation",
        "technique": "T1548",
        "name":      "Abuse Elevation Control Mechanism",
        "url":       "https://attack.mitre.org/techniques/T1548/",
    },

    "port_scan": {
        "tactic":    "Reconnaissance",
        "technique": "T1046",
        "name":      "Network Service Discovery",
        "url":       "https://attack.mitre.org/techniques/T1046/",
    },

    "persistence": {
        "tactic":    "Persistence",
        "technique": "T1136",
        "name":      "Create Account",
        "url":       "https://attack.mitre.org/techniques/T1136/",
    },

    "anomalous_behavior": {
        "tactic":    "Defense Evasion",
        "technique": "T1036",
        "name":      "Masquerading",
        "url":       "https://attack.mitre.org/techniques/T1036/",
    },

    "lateral_movement": {
        "tactic":    "Lateral Movement",
        "technique": "T1021",
        "name":      "Remote Services — SSH",
        "url":       "https://attack.mitre.org/techniques/T1021/004/",
    },

    "web_attack": {
        "tactic":    "Initial Access",
        "technique": "T1190",
        "name":      "Exploit Public-Facing Application",
        "url":       "https://attack.mitre.org/techniques/T1190/",
    },

    "c2_communication": {
        "tactic":    "Command and Control",
        "technique": "T1071",
        "name":      "Application Layer Protocol",
        "url":       "https://attack.mitre.org/techniques/T1071/",
    },

    "log_tampering": {
        "tactic":    "Defense Evasion",
        "technique": "T1070",
        "name":      "Indicator Removal",
        "url":       "https://attack.mitre.org/techniques/T1070/",
    },

    "reverse_shell": {
        "tactic":    "Execution",
        "technique": "T1059",
        "name":      "Command and Scripting Interpreter",
        "url":       "https://attack.mitre.org/techniques/T1059/",
    },

    "default": {
        "tactic":    "Unknown",
        "technique": "T0000",
        "name":      "Uncategorized",
        "url":       "https://attack.mitre.org/",
    },
}


def get_mitre_info(alert_type: str) -> dict:
    """Return MITRE ATT&CK info for a given alert type, or the default entry."""
    return MITRE_MAPPINGS.get(alert_type, MITRE_MAPPINGS["default"])
