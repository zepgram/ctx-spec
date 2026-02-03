# Context Daemon

> **Automatic context capture for AI coding** — Git tracks *what* changed, Context Daemon tracks *why*.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem

When you code with AI tools, the *reasoning* is lost:

```
You → Prompt → Claude/Cursor/Copilot → Code → Commit

                    ↓
              [ LOST FOREVER ]
        - Why this approach?
        - What alternatives were rejected?
        - What was the business context?
```

6 months later, you (or another AI) picks up the project → **zero context**. Start from scratch.

## The Solution

**Context Daemon** runs invisibly alongside your AI coding tools, capturing the intent behind every change:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONTEXT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│   Git     = Version control for CODE                            │
│   Docker  = Packaging for ENVIRONMENT                           │
│   ctxd    = Packaging for INTENT                                │
└─────────────────────────────────────────────────────────────────┘
```

**Capture invisible. Reading explicit.** You change nothing about your workflow.

## Quick Start

```bash
# Install
npm install -g context-daemon

# Start daemon (runs in background)
ctxd start

# That's it. Work normally with Claude Code, Cursor, Copilot...
# Context accumulates automatically in .context/
```

## What it captures

Every AI interaction is logged:

```jsonl
// .context/intent-log.jsonl (auto-generated)
{
  "ts": "2026-02-03T14:32:00Z",
  "tool": "claude-code",
  "prompt": "Add Redis cache for user sessions, we have perf issues at 10k users",
  "files": ["src/auth/session.ts", "src/config/redis.ts"],
  "diff": "a3f2c1d",
  "intent": {
    "category": "performance",
    "problem": "scaling bottleneck at 10k concurrent users",
    "solution": "Redis session cache"
  },
  "commit": "feat: add redis session cache"
}
```

Significant decisions become ADRs automatically:

```markdown
<!-- .context/decisions/003-redis-sessions.md (auto-generated) -->
# ADR-003: Redis for Sessions

## Context
Performance issues with 10k concurrent users.

## Decision
Implement Redis as session cache.

## Alternatives Rejected
- Memcached: fewer features (no persistence)
- In-memory LRU: doesn't scale horizontally

## Consequences
- New infra dependency (Redis)
- Need to manage connection pooling
```

## The Magic: `context.lock`

Like `package-lock.json` but for project understanding:

```yaml
# .context/context.lock
version: "1.0"
generated: "2026-02-03T15:00:00Z"
hash: "sha256:9f86d08..."

summary:
  architecture: "TypeScript monorepo, REST API + Worker queues"
  key_decisions: 12
  active_constraints: 5
  domain_terms: 23

semantic_index:
  - concept: "authentication"
    files: ["src/auth/*"]
    decisions: ["ADR-001", "ADR-003"]
    
  - concept: "payment"
    files: ["src/billing/*"]  
    decisions: ["ADR-002"]
    constraints: ["PCI-DSS compliance"]
```

**Clone the repo = clone the understanding.**

## 6 Months Later

```
New developer (or AI):
> "Why do we use Redis here?"

AI reads .context/ and answers:
> "Redis was added on Feb 3, 2026 to solve a performance bottleneck
>  at 10k concurrent users. Memcached was rejected because you needed
>  persistence. See ADR-003 for full context."
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      DEVELOPER WORKFLOW                          │
│                                                                  │
│    ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐            │
│    │ Cursor │   │ Claude │   │Copilot │   │Windsurf│            │
│    └───┬────┘   └───┬────┘   └───┬────┘   └───┬────┘            │
│        └────────────┴────────────┴────────────┘                  │
│                          │                                       │
│                          ▼                                       │
│               ┌─────────────────────┐                            │
│               │   CONTEXT DAEMON    │                            │
│               │       (ctxd)        │                            │
│               │                     │                            │
│               │  • Watch file changes│                           │
│               │  • Intercept prompts │                           │
│               │  • Infer intent      │                           │
│               │  • Link to commits   │                           │
│               │  • Generate ADRs     │                           │
│               └──────────┬──────────┘                            │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    .context/ DIRECTORY                           │
│                                                                  │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐       │
│  │intent-log.jsonl│ │  decisions/    │ │ context.lock   │       │
│  │                │ │                │ │                │       │
│  │ Every AI      │ │  ADR-001.md   │ │ Semantic hash  │       │
│  │ interaction   │ │  ADR-002.md   │ │ of project     │       │
│  │ with intent   │ │  ADR-003.md   │ │ understanding  │       │
│  └────────────────┘ └────────────────┘ └────────────────┘       │
│                                                                  │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐       │
│  │ glossary.yaml  │ │constraints.yaml│ │  project.yaml  │       │
│  │                │ │                │ │                │       │
│  │ Domain terms  │ │ Rules/limits  │ │ Stack, config │       │
│  │ (auto-learned)│ │ (auto-inferred)│ │ (auto-detected)│       │
│  └────────────────┘ └────────────────┘ └────────────────┘       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## CLI Commands

```bash
# Daemon control
ctxd start              # Start background daemon
ctxd stop               # Stop daemon
ctxd status             # Check if running

# Context inspection
ctx log                 # View recent intent log
ctx log --since 7d      # Last 7 days
ctx decisions           # List ADRs
ctx why src/auth/       # Why does this code exist?

# Context management
ctx lock                # Generate/update context.lock
ctx export              # Export for AI consumption
ctx clean               # Remove old entries

# Migration
ctx migrate --from cursor    # Import .cursorrules
ctx migrate --from claude    # Import CLAUDE.md
```

## How Capture Works

### 1. File Watcher
Monitors file changes and correlates with git operations.

### 2. Prompt Interception
Hooks into AI tools via:
- **Claude Code**: `~/.claude/logs/` parsing
- **Cursor**: Extension API / log files
- **Copilot**: VS Code extension hooks
- **Generic**: Clipboard monitoring (opt-in)

### 3. Intent Inference
LLM-powered analysis of prompt + diff → structured intent:

```
Input:  "Add Redis cache for sessions, perf issues at 10k users"
Output: {
  category: "performance",
  problem: "scaling bottleneck",
  solution: "Redis session cache",
  alternatives: ["memcached", "in-memory"]
}
```

### 4. Commit Linking
Git hooks link intent entries to commits automatically.

## Privacy & Security

- **Local-first**: All data stays in `.context/` (committed with your code)
- **No cloud**: Daemon runs 100% locally
- **Opt-out**: `ctx pause` to temporarily disable capture
- **Redact**: `ctx redact <entry-id>` to remove sensitive entries
- **Gitignore**: Add `.context/intent-log.jsonl` to ignore raw logs if needed

## Supported Tools

| Tool | Capture Method | Status |
|------|---------------|--------|
| Claude Code | Log parsing | ✅ Supported |
| Cursor | Extension API | 🚧 In progress |
| GitHub Copilot | VS Code hooks | 🚧 Planned |
| Windsurf | TBD | 📋 Planned |
| Aider | Log parsing | 📋 Planned |

## Roadmap

- [x] Spec v0.1
- [ ] Daemon core (file watcher, git hooks)
- [ ] Claude Code integration
- [ ] Intent inference (local LLM or API)
- [ ] ADR auto-generation
- [ ] context.lock generation
- [ ] Cursor integration
- [ ] VS Code extension
- [ ] Team sync (Context Cloud)

## Philosophy

> "The best documentation is the one that writes itself."

Context Daemon follows three principles:

1. **Invisible capture** — Zero friction, zero workflow change
2. **Explicit reading** — Context is always inspectable and editable  
3. **Portable understanding** — Clone repo = understand project

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — Use it anywhere, fork it, make it yours.

---

**Context Daemon** — *Because the "why" matters as much as the "what".*
