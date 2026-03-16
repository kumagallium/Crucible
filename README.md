[日本語](README.ja.md)

# Crucible

> **The sandbox for building and testing MCP servers.**
> Paste a GitHub URL. Build, deploy, experiment — all in one place.

**Crucible** is a self-hosted sandbox for MCP server development. Paste a GitHub repository URL — including private repos — and Crucible automatically builds, deploys, and exposes it as an SSE endpoint. No need to publish to npm or Docker Hub first. Try it, break it, iterate — all from a single dashboard.

## Key Features

- **Build from any GitHub URL** — Paste a repository URL and Crucible builds and deploys it automatically. Skip the publish-to-npm step and go straight from source to running server.
- **Private repository support** — Works with private GitHub repositories. Develop your MCP servers behind closed doors and deploy them without ever making them public.
- **Instant iteration** — Made a change? Push to GitHub, redeploy from Crucible. The feedback loop from code to running server is as short as it gets.
- **Automatic stdio → SSE** — stdio-only servers are automatically exposed as SSE endpoints, so you can test them from any MCP client, local or remote.
- **Management UI** — See all your experimental servers in one dashboard. Start, stop, remove — keep your sandbox clean.
- **Secure & self-hosted** — Runs entirely on your infrastructure. Docker Socket Proxy limits Docker operations to minimum privileges. Nothing leaves your network.

## Who is Crucible for?

- **MCP server developers** who want to go from `git push` to a running server in seconds — without publishing packages or writing Dockerfiles first.
- **Research teams and organizations** encouraging members to build domain-specific MCP servers — Crucible gives everyone a shared sandbox to deploy and experiment.
- **Anyone exploring GitHub** for MCP servers that aren't on npm or Docker Hub yet — just paste the URL and try it.

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
