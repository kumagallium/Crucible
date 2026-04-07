# Contributing to Crucible Registry

Thank you for your interest in contributing to Crucible Registry! This guide will help you get started.

## Development Setup

### Prerequisites

- Python 3.11+ with [uv](https://docs.astral.sh/uv/)
- Node.js 22+ with npm
- Docker & Docker Compose

### Getting Started

```bash
# Clone the repository
git clone https://github.com/kumagallium/Crucible.git
cd Crucible/registry

# Run setup script
./setup.sh

# Or manually set up each component:

# API (Python/FastAPI)
cd api
uv sync --dev
cp ../.env.example ../.env
uv run uvicorn main:app --reload --port 8080

# UI (Next.js)
cd ../ui
npm install
npm run dev
```

### Running Tests

```bash
# API tests
cd api
uv run pytest

# UI tests
cd ui
npm test

# UI tests with coverage
npm run test:coverage
```

### Linting

```bash
# UI
cd ui
npm run lint

# API (if ruff is configured)
cd api
uv run ruff check .
```

## How to Contribute

### Reporting Bugs

1. Search [existing issues](https://github.com/kumagallium/Crucible/issues) to avoid duplicates
2. Open a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Python/Node version)

### Suggesting Features

Open an issue with the `enhancement` label describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Make your changes
4. Run tests for affected components (API and/or UI)
5. Ensure the build succeeds (`npm run build` for UI)
6. Commit with a clear message following the [commit convention](#commit-messages)
7. Push and open a Pull Request

### Commit Messages

```
[type] Short description

Types:
  feat     - New feature or new MCP tool
  fix      - Bug fix
  mcp      - MCP server related
  infra    - Infrastructure / setup
  docs     - Documentation
  refactor / chore
```

Example: `[feat] Add CLI/Library tool type support`

## Architecture Overview

Crucible Registry consists of two components:

| Component | Tech Stack | Directory |
|-----------|-----------|-----------|
| **API** | Python / FastAPI / Pydantic | `api/` |
| **UI** | Next.js / React / Tailwind CSS | `ui/` |

### Three-Layer Tool Model

Crucible manages three types of tools:

- **MCP Servers**: Full SSE/stdio servers deployed via Docker
- **CLI / Libraries**: Lightweight pip/npm packages
- **Skills**: Markdown-based procedure templates

## Code Style

- **API**: Python with type hints. Follow Ruff defaults
- **UI**: TypeScript with strict mode. Follow Next.js/ESLint conventions
- **CSS**: Tailwind CSS utility classes

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
