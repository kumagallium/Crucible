# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Crucible Registry, please report it responsibly.

### How to Report

1. **Do NOT open a public issue** for security vulnerabilities
2. Email: **kumagallium@gmail.com**
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

This is a volunteer-maintained project, so we cannot guarantee specific response times. That said, we will do our best to:

- **Acknowledge** your report promptly
- **Assess** the issue and communicate next steps
- **Prioritize** fixes based on severity

### Scope

The following are in scope:

- Authentication bypasses (API token validation)
- Token encryption weaknesses (AES-256-GCM implementation)
- Server-side request forgery (SSRF) via deploy endpoints
- Unauthorized access to registered MCP server credentials
- Command injection via deploy pipelines
- Cross-site scripting (XSS) in the UI

The following are out of scope:

- Issues in third-party dependencies (report upstream)
- Denial of service via legitimate API usage
- Attacks requiring SSH access to the host server

## Security Architecture

Crucible Registry includes several security measures:

- **API authentication**: Token-based access control
- **AES-256-GCM encryption**: MCP server tokens encrypted at rest
- **SSH tunnel access**: Production is not exposed to the public internet
- **UFW firewall**: Only SSH port is externally accessible
- **fail2ban**: Brute-force protection (24h ban after 5 failures)
- **Token masking**: Sensitive values are masked in deploy logs
- **Automatic security updates**: Enabled on production servers

## Disclosure Policy

We follow a coordinated disclosure process. Please allow us reasonable time to address the issue before public disclosure.
