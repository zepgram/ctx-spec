# CTX Spec

> The `.gitignore` for AI coding — a simple, open standard that helps AI tools understand your codebase context.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why?

AI coding tools (Claude Code, Cursor, Copilot, Codex...) need context to work well. Today, this context is:

- 🔀 **Fragmented** — `.cursorrules`, `.clinerules`, `CLAUDE.md`, all incompatible
- 🔒 **Proprietary** — each tool has its own format
- 💨 **Ephemeral** — lost between sessions
- 🤷 **Implicit** — AI guesses instead of knowing

**CTX Spec** fixes this with a simple, open standard that any AI tool can read.

## Quick Start

```bash
# Install CLI
npm install -g ctx-spec

# Initialize in your project
ctx init

# That's it. AI tools will read .ctx/ automatically.
```

## What it creates

```
.ctx/
├── project.yaml       # Project metadata
├── architecture.md    # System design (optional)
├── constraints.yaml   # Rules the AI must follow
├── glossary.yaml      # Domain terms
└── intent.md          # Current focus/goals
```

## Example

```yaml
# .ctx/project.yaml
name: my-ecommerce
description: E-commerce platform on Nuxt 3
stack:
  - nuxt3
  - typescript
  - pinia
  - tailwind

ai_instructions: |
  - Use Composition API, not Options API
  - All API calls go through /src/api/
  - Follow existing patterns in /src/composables/
```

```yaml
# .ctx/constraints.yaml
rules:
  - Never commit secrets or API keys
  - All components must have TypeScript props
  - Use Pinia for state, not local component state
  - Performance: LCP must stay under 3s

forbidden_patterns:
  - "console.log" in production code
  - Direct database access from components
  - Any use of `any` type without comment
```

## For AI Tool Developers

CTX Spec is designed for easy adoption:

1. **Detect** `.ctx/` directory in project root
2. **Read** `project.yaml` + relevant files
3. **Inject** into system prompt or context
4. **Respect** constraints as hard rules

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for full integration guide.

## Spec

Full specification: [docs/SPEC.md](docs/SPEC.md)

### Core Files

| File | Required | Purpose |
|------|----------|---------|
| `project.yaml` | ✅ | Project metadata, stack, AI instructions |
| `constraints.yaml` | ❌ | Rules AI must follow |
| `architecture.md` | ❌ | System design, module boundaries |
| `glossary.yaml` | ❌ | Domain terms and definitions |
| `intent.md` | ❌ | Current working focus |

### Design Principles

1. **Simple** — Plain text files, no runtime needed
2. **Portable** — Works with any AI tool
3. **Git-native** — Version, diff, merge like code
4. **Opt-in** — Start minimal, add as needed

## CLI Commands

```bash
ctx init                 # Create .ctx/ with defaults
ctx validate             # Check .ctx/ structure
ctx export               # Compile to single markdown (for copy-paste)
ctx export --json        # Export as JSON
ctx migrate --from cursor  # Import from .cursorrules
```

## Roadmap

- [x] Spec v0.1
- [ ] CLI tool (ctx init, validate, export)
- [ ] Claude Code integration
- [ ] Cursor integration
- [ ] VS Code extension
- [ ] CTX Cloud (team sync, analytics)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md).

- 💬 [Discussions](https://github.com/zepgram/ctx-spec/discussions)
- 🐛 [Issues](https://github.com/zepgram/ctx-spec/issues)
- 🐦 [@zepgram](https://twitter.com/zepgram)

## License

MIT — Use it anywhere, fork it, make it yours.

---

**CTX Spec** — *Because AI tools deserve a standard way to understand your code.*
