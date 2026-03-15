[日本語](README.ja.md)

# Crucible

> **Your MCP servers, on your infrastructure, under your control.**

**Crucible** is a self-hosted registry for building, deploying, and managing MCP (Model Context Protocol) servers. Just paste a GitHub repository URL and Crucible automatically builds and deploys it as a running MCP server, ready to connect from Claude Desktop, Claude Code, Cursor, and other MCP clients.

## Key Features

- **Build from GitHub URL** — Paste any GitHub repository URL and Crucible automatically builds and deploys it as a running MCP server. No pre-built images or package registry required.
- **Private repository support** — Works with private GitHub repositories. Your proprietary MCP servers never need to be published to a public registry.
- **Automatic stdio → SSE** — stdio-only servers are automatically exposed as SSE endpoints via mcp-proxy, so any MCP client can connect remotely.
- **Management UI** — Monitor status, restart, and remove servers from your browser.
- **Secure by default** — Docker Socket Proxy limits Docker operations to minimum privileges.
- **Fully self-hosted** — No external service dependencies. Everything runs on your machine, your network, under your control.

## Who is Crucible for?

- **Individual developers** juggling multiple MCP servers across Claude Code, Cursor, and other clients — tired of managing each one manually.
- **Small teams** that want to share MCP tools internally without relying on external SaaS platforms.
- **Organizations** that need to keep AI tool access on their own infrastructure for security, compliance, or policy reasons.

> [See detailed use cases and scenarios on our website](https://kumagallium.github.io/Crucible/)

## Architecture

```
┌─────────────────────────────────────┐
│            Crucible                  │
│  ┌─────────┐      ┌──────────────┐  │
│  │   UI    │◄────►│   API        │  │
│  │ Next.js │      │  FastAPI     │  │
│  └─────────┘      └──────┬───────┘  │
│                          │          │
│              ┌───────────▼────────┐ │
│              │  Socket Proxy      │ │
│              │  (Docker ops)      │ │
│              └───────────┬────────┘ │
│                          │          │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │MCP-A │ │MCP-B │ │MCP-C │ ...   │
│  └──────┘ └──────┘ └──────┘       │
└─────────────────────────────────────┘
```

<!-- TODO: Add demo GIF showing: paste GitHub URL → auto build → deploy → connect from Claude Code via SSE -->

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Git

### Setup

```bash
# 1. Clone
git clone https://github.com/kumagallium/Crucible.git
cd Crucible

# 2. Configure environment variables
cp .env.example .env
chmod 600 .env
# Edit .env and set the required values

# 3. Start
docker compose up -d
```

### Access

- **UI**: http://127.0.0.1:8081
- **API**: http://127.0.0.1:8080

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CRUCIBLE_HOST` | `127.0.0.1` | IP address to bind ports to |
| `CRUCIBLE_API_PORT` | `8080` | API port |
| `CRUCIBLE_UI_PORT` | `8081` | UI port |
| `CRUCIBLE_BASE_URL` | `http://127.0.0.1` | Base URL for MCP server SSE endpoints |
| `CRUCIBLE_CORS_ORIGINS` | *(localhost)* | Allowed CORS origins (comma-separated) |
| `REGISTRY_API_KEY` | *(none)* | API authentication key |
| `TOKEN_ENCRYPTION_KEY` | *(none)* | Encryption key for GitHub tokens |

See [.env.example](.env.example) for details.

## Remote Access (Optional)

To access Crucible from another machine, update the bind address in your environment variables:

```env
# Example: access via VPN
CRUCIBLE_HOST=10.0.0.1
CRUCIBLE_BASE_URL=http://10.0.0.1
CRUCIBLE_CORS_ORIGINS=http://10.0.0.1:8081,http://localhost:8081
```

No configuration is needed for local-only use (default).

## Connecting from MCP Clients

MCP servers deployed on Crucible are accessible via SSE endpoints.

### Claude Code

```bash
claude mcp add --transport sse <server-name> http://<host>:<port>/sse
```

### Cursor / Windsurf

Add the SSE URL from the settings screen.

### Claude Desktop

Claude Desktop does not natively support SSE. Use [mcp-remote](https://www.npmjs.com/package/mcp-remote) for stdio-to-SSE bridging. See the **Guide** tab in the UI for details.

## Integrations (Optional)

### Dify

Crucible can automatically register deployed MCP servers as tools in Dify.
Set `DIFY_EMAIL` and `DIFY_PASSWORD` in your `.env` to enable.

## Tech Stack

| Component | Technology |
|-----------|------------|
| API | Python / FastAPI |
| UI | TypeScript / Next.js / shadcn/ui |
| Container management | Docker / Docker Socket Proxy |
| MCP SDK | `@modelcontextprotocol/sdk` / `mcp` (Python) |

## Documentation & Website

- [Website (detailed use cases)](https://kumagallium.github.io/Crucible/)

## License

[MIT License](LICENSE)
