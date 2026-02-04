# Context Daemon Specification v3.0

> **Automatic context capture for AI coding**  
> Git tracks what changed. Context Daemon tracks why.

| Field | Value |
|-------|-------|
| Version | 3.0.0 |
| Date | 2026-02-04 |
| Status | Complete Specification |
| Author | Context Spec Project |
| License | MIT |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary) — Problem, solution, key principles
2. [Architecture Overview](#2-architecture-overview) — System components and data flow
3. [Capture System](#3-capture-system) — Claude Code logs, file watching, multi-tool support
4. [context.lock Specification](#4-contextlock-specification) — Core semantic snapshot format
5. [Cold Start Solution](#5-cold-start-solution) — Retroactive import and bootstrap
6. [Intent Inference](#6-intent-inference) — Async processing, cost optimization
7. [Agent Discovery](#7-agent-discovery) — CLAUDE.md sync, MCP Server
8. [Git Integration](#8-git-integration) — Commit linking, multi-developer support
9. [Security & Privacy](#9-security--privacy) — Redaction, compliance modes
10. [Scaling & Performance](#10-scaling--performance) — Archiving, indexing, context budget
11. [CLI Reference](#11-cli-reference) — Complete command reference
12. [File Structure](#12-file-structure) — Complete .context/ layout

---

## 1. Executive Summary

### 1.1 The Problem

When developers code with AI tools, the reasoning behind changes is systematically lost. The prompt, the context, the rejected alternatives — all disappear after each session. Six months later, neither humans nor AI can reconstruct why decisions were made.

### 1.2 The Solution

Context Daemon introduces a new infrastructure layer alongside Git and Docker:

| Layer | Purpose | Tracks |
|-------|---------|--------|
| Git | Version control | WHAT changed (code) |
| Docker | Environment packaging | WHERE code runs |
| ctxd | Intent packaging | WHY code exists |

### 1.3 Key Principles

- **Invisible capture** — Zero friction, zero workflow change
- **Explicit reading** — Context is always inspectable and editable
- **Portable understanding** — Clone the repo = clone the understanding
- **Value from day one** — Retroactive import of existing history

### 1.4 Validated Assumptions

- ✓ Claude Code logs prompts in `~/.claude/projects/*.jsonl` (confirmed)
- ✓ 90 days of history available for retroactive import
- ✓ JSONL format is stable and documented by community tools
- ✓ No interception needed — simple file watching is sufficient

---

## 2. Architecture Overview

### 2.1 System Components

| Component | Role | Key Feature |
|-----------|------|-------------|
| ctxd (daemon) | Background file watcher | Zero-latency capture |
| ctx (CLI) | User interface | blame, search, log, sync |
| intent-log | Raw interaction history | Per-session JSONL files |
| context.lock | Semantic snapshot | AI-readable project summary |
| decisions/ | Architecture records | Auto-generated ADRs |
| MCP Server | Programmatic access | Tool-based context retrieval |

### 2.2 Data Flow

```
CAPTURE FLOW (real-time, zero latency):

Claude Code writes          ctxd watches            Writes to
~/.claude/projects/   ───────────────────>   .context/intents/
     *.jsonl               (inotify)          {date}_{user}.jsonl


PROCESSING FLOW (async, background):

.context/intents/        Batch inference           Updates
    *.jsonl         ───────────────────>     context.lock
                      (hourly/nightly)        decisions/*.md


CONSUMPTION FLOW (on-demand):

ctx sync              Generates              Agent reads
────────────>     CLAUDE.md          <────────────────
                  .cursorrules          (existing behavior)
```

---

## 3. Capture System

### 3.1 Claude Code Log Format (Confirmed)

Claude Code stores full conversation logs locally. This is the primary capture source.

| Property | Value |
|----------|-------|
| Location | `~/.claude/projects/{encoded-directory}/*.jsonl` |
| Retention | 30 days default (configurable via settings.json) |
| Format | Newline-delimited JSON (JSONL) |

### 3.2 JSONL Message Structure

```json
{
  "parentUuid": null,
  "sessionId": "797df13f-41e5-4ccd-9f00-d6f6b9bee0b3",
  "version": "1.0.38",
  "type": "user",
  "cwd": "/Users/dev/project",
  "gitBranch": "main",
  "message": {
    "role": "user",
    "content": "Add Redis cache for sessions, perf issues at 10k users"
  },
  "uuid": "d02cab21-cc42-407e-80cb-6305ac542803",
  "timestamp": "2025-07-01T10:43:40.323Z"
}
```

### 3.3 Available Fields

| Field | Type | Use for Context Daemon |
|-------|------|------------------------|
| message.content | string | THE PROMPT — primary capture target |
| sessionId | uuid | Group interactions in a session |
| cwd | path | Working directory (project detection) |
| gitBranch | string | Current branch |
| timestamp | ISO-8601 | Temporal linking with commits |
| parentUuid | uuid | Chain multi-turn conversations |
| type | user\|assistant | Filter user prompts vs responses |

### 3.4 Multi-Tool Capture Strategy

| Layer | Method | Stability | Tools Supported |
|-------|--------|-----------|-----------------|
| 1 (Primary) | Native log parsing | High | Claude Code ✓ |
| 2 (Extension) | IDE plugin/extension | Medium | Cursor, VS Code |
| 3 (Universal) | Clipboard monitoring | High | All (opt-in) |
| 4 (Manual) | `ctx log "prompt"` | High | All tools |

### 3.5 Retention Configuration

```json
// ~/.claude/settings.json
{
  "cleanupPeriodDays": 99999  // Default is 30, set high to preserve history
}
```

> ⚠️ **IMPORTANT:** Configure this BEFORE relying on historical import

---

## 4. context.lock Specification

The `context.lock` file is the semantic snapshot of project understanding. Designed to fit in AI context windows (< 4000 tokens) while providing sufficient information to bootstrap agent understanding.

### 4.1 Structure Overview

| Section | Auto-generated? | Purpose |
|---------|-----------------|---------|
| project | Yes | Identity, description, domain |
| stack | Yes | Detected technical stack |
| architecture | Partial | Module boundaries |
| decisions | Index only | Pointers to ADRs with triggers |
| constraints | Suggested | Active rules and limits |
| glossary | Extracted | Domain terminology |
| recent | Yes | Last 7 days working memory |
| agent | Yes | Instructions for AI agents |

### 4.2 Core Sections (Auto-generated)

```yaml
# .context/context.lock
spec_version: "1.0.0"
generated_at: "2026-02-03T15:00:00Z"
checksum: "sha256:9f86d08..."

project:
  name: "zadig-ecommerce"              # From package.json/go.mod
  domain: "Fashion e-commerce B2C"     # Inferred or manual
  repository: "github.com/zadig/platform"
  description: |
    Omnichannel e-commerce platform for Zadig&Voltaire.
    Handles catalog, checkout, inventory sync with stores.

stack:
  detected_from: ["package.json", "tsconfig.json", "prisma/schema.prisma"]
  runtime: "Node.js 20 LTS"
  language: "TypeScript 5.3 (strict)"
  framework:
    frontend: "Nuxt 3.8"
    backend: "Fastify 4.x"
  database:
    primary: "PostgreSQL 15"
    cache: "Redis 7"
  key_dependencies:
    - { name: "prisma", version: "5.x", purpose: "ORM" }
    - { name: "stripe", version: "14.x", purpose: "Payments" }
```

### 4.3 Decisions Section (Critical)

Each decision includes **triggers** — keywords that help agents identify when a decision is relevant. This enables semantic retrieval without full-text search.

```yaml
decisions:
  - id: "ADR-001"
    title: "Redis for session management"
    date: "2026-02-03"
    status: "accepted"
    # Keywords that trigger this decision lookup
    triggers:
      - "session"
      - "auth"
      - "redis"
      - "login"
      - "performance"
      - "10k users"
    summary: "Redis for sessions to handle 10k+ concurrent users"
    impact:
      files: ["src/auth/*", "src/config/redis.ts"]
      dependencies_added: ["ioredis"]
```

### 4.4 Constraints Section

```yaml
constraints:
  regulatory:
    - id: "PCI-DSS"
      scope: ["src/modules/checkout/payment/*"]
      rule: "No card data storage. Tokenization only via Stripe."
      violation_examples:
        - "Storing card numbers in database"
        - "Logging full card details"
  
  technical:
    - id: "RESPONSE-TIME-SLA"
      scope: ["src/modules/catalog/api/*"]
      rule: "p99 latency < 200ms for catalog reads"
  
  business:
    - id: "CHECKOUT-FREEZE"
      scope: ["src/modules/checkout/*"]
      rule: "No breaking changes during peak season"
      expires: "2026-01-15"
      status: "expired"  # active | expired
```

### 4.5 Agent Instructions Section

```yaml
agent:
  bootstrap:
    always_read: [".context/context.lock"]
    read_if_exists: ["CLAUDE.md", ".cursorrules"]
    max_bootstrap_tokens: 4000
  
  retrieval:
    strategy: "trigger_match"
    trigger_rules:
      - match: ["auth", "session", "login", "user"]
        load: ["decisions/ADR-001.md"]
      - match: ["payment", "checkout", "stripe"]
        load: ["decisions/ADR-002.md", "constraints.yaml#PCI-DSS"]
  
  context_budget:
    total_tokens: 4000
    allocation:
      project: 200       # Always included
      constraints: 400   # Always (security)
      decisions: 1500    # Dynamic by relevance
      recent: 300        # Working memory
      reserve: 1600      # For loaded ADRs
```

---

## 5. Cold Start Solution

The cold start problem — no value on day 1 — is solved through retroactive import of existing Claude Code history and intelligent project bootstrapping.

### 5.1 Retroactive Import

```bash
$ ctx init --import-history

■ Found Claude Code logs in ~/.claude/projects/...

Discovered:
  - 47 sessions over last 90 days
  - 1,247 user prompts
  - Linked to project: /Users/dev/zadig-ecommerce

Import historical context? [y/N] y

✓ Imported 1,247 prompts
✓ Linked 892 to git commits (by timestamp correlation)
✓ Inferred 45 significant decisions
✓ Generated context.lock with historical data

Context score: 58/100
"You have 90 days of history. Add constraints to improve."
```

### 5.2 Project Bootstrap (No History)

```bash
$ ctx init

[1/5] Stack detection
  ✓ Node.js 20 (from package.json)
  ✓ TypeScript 5.3 (from tsconfig.json)
  ✓ Nuxt 3.8 (from nuxt.config.ts)
  ✓ PostgreSQL (from prisma/schema.prisma)

[2/5] Architecture inference
  ✓ Detected modular structure:
    - src/modules/catalog/ (42 files)
    - src/modules/checkout/ (38 files)

[3/5] Decision archaeology (analyzing 1,247 commits)
  Found 5 significant changes:
    ■ 2024-03-15: TypeScript migration (1,247 files)
    ■ 2025-09-12: Stripe integration (45 files)
  → Suggested ADRs generated

[4/5] Constraint detection
  ✓ Stripe SDK detected → Suggest PCI-DSS constraint
  ✓ GDPR comments found → Suggest privacy constraint

[5/5] Glossary extraction
  ✓ 18 domain terms from code and docs

Context score: 67/100 (before any capture)
```

### 5.3 Value Timeline

| Day | Without Import | With Import |
|-----|----------------|-------------|
| 0 | Using Claude Code normally | Logs accumulating |
| 1 | Install → empty → no value | Install → import 90d → ctx blame works |
| 7 | Some context, limited value | Rich context + new captures |
| 30 | Maybe useful | Comprehensive project memory |

---

## 6. Intent Inference

Inference is async and optional. The system provides value without any LLM through `ctx blame` and search. Inference adds structured intent and auto-generated ADRs.

### 6.1 Processing Strategy

| Phase | Timing | LLM? | Latency | Cost |
|-------|--------|------|---------|------|
| Capture | Real-time | No | < 10ms | $0 |
| Enrichment | Background batch | Optional | N/A | Batched |
| ADR Generation | On significant change | Yes | Async | Per-ADR |
| On-demand | `ctx analyze` | Yes | 2-5s | Per-call |

### 6.2 Inference Configuration

```yaml
inference:
  strategy: "hybrid"  # local | api | hybrid | rules_only

  local:
    enabled: true
    runtime: "ollama"
    model: "llama3.2:3b"
    fallback_model: "qwen2.5:1.5b"
    timeout_ms: 5000

  api:
    enabled: true
    provider: "anthropic"
    model: "claude-3-haiku"
    max_daily_calls: 100

  batch:
    enabled: true
    interval: "1h"
    max_batch_size: 20

  # Zero-cost fallback
  rules_only:
    category_rules:
      - { match: "(add|create|implement)", category: "feature" }
      - { match: "(fix|bug|error)", category: "bugfix" }
      - { match: "(refactor|clean)", category: "refactoring" }
      - { match: "(perf|optimize|cache)", category: "performance" }
```

### 6.3 Cost Analysis

| Strategy | Cost/Dev/Month | Team of 10 |
|----------|----------------|------------|
| Rules only | $0 | $0 |
| Local LLM (Ollama) | $0 (compute only) | $0 |
| API without batching | $3.00 | $30 |
| API with batching | $0.60 | $6 |

---

## 7. Agent Discovery

Agents don't need to change behavior. Context Daemon syncs to files they already read.

### 7.1 Sync to Existing Files

```bash
$ ctx sync

✓ Generated CLAUDE.md from context.lock
  - Project summary
  - Active constraints (PCI-DSS, GDPR)
  - Recent context (last 7 days)
  - Decision triggers

✓ Generated .cursorrules from context.lock
  - Constraint rules
  - Naming conventions
```

### 7.2 Generated CLAUDE.md Example

```markdown
<!-- AUTO-GENERATED by Context Daemon -->
<!-- Edit .context/context.lock, then run: ctx sync -->

# Project Context

## Summary
Omnichannel e-commerce platform for Zadig&Voltaire.
TypeScript monorepo with Nuxt 3 frontend and Fastify API.

## Active Constraints

### PCI-DSS (checkout module)
- No card data storage, tokenization only via Stripe
- DO NOT store card numbers in database
- DO NOT log card details

### GDPR (customer module)
- Consent tracking required
- Must support data export and deletion

## Decision Lookup
When asked about:
- auth, session, login → See ADR-001 (Redis sessions)
- payment, stripe, checkout → See ADR-002 (Stripe)
- search, algolia → See ADR-003 (Algolia)

## Recent Context (auto-updated)
Last 7 days: Performance optimization for winter sales.
Redis session cache deployed. Investigating Algolia batching.
```

### 7.3 MCP Server Tools

| Tool | Description | When to Call |
|------|-------------|--------------|
| get_project_context | Returns overview, stack, constraints | Session start |
| search_decisions | Search ADRs by keyword | "Why" questions |
| get_intent_for_file | Intent history for a file | Understanding code |
| check_constraints | Validate changes against rules | Before edits |
| log_intent | Record intent of changes | After edits |

---

## 8. Git Integration

### 8.1 Commit Linking

Intent entries are linked to commits via git hooks and timestamp correlation.

```bash
# .git/hooks/prepare-commit-msg
STAGED_FILES=$(git diff --cached --name-only)
INTENT_IDS=$(ctxd query-intents --files "$STAGED_FILES" --uncommitted)

if [ -n "$INTENT_IDS" ]; then
  echo "" >> "$COMMIT_MSG_FILE"
  echo "Context-Intent: $INTENT_IDS" >> "$COMMIT_MSG_FILE"
fi
```

```bash
# .git/hooks/post-commit
COMMIT_HASH=$(git rev-parse HEAD)
INTENT_IDS=$(git log -1 --pretty=%B | grep "Context-Intent:" | cut -d: -f2)

for ID in $INTENT_IDS; do
  ctxd link-commit --intent "$ID" --commit "$COMMIT_HASH"
done
```

### 8.2 Multi-Developer Support

Avoid merge conflicts by using per-session files instead of a single log file.

```
.context/intents/
├── 2026-02-03_alice_abc123.jsonl   # Alice's session
├── 2026-02-03_bob_def456.jsonl     # Bob's session (same day, no conflict)
├── 2026-02-04_alice_ghi789.jsonl   # Alice's new session
└── ...
```

```bash
# ctx log aggregates all files at read time
$ ctx log              # Shows all
$ ctx log --author alice   # Filter by author
```

### 8.3 Heuristic Linking (Fallback)

| Signal | Weight | Description |
|--------|--------|-------------|
| Time proximity | 0.3 | Intent timestamp vs commit timestamp |
| File overlap | 0.5 | Files in intent vs files in commit |
| Message similarity | 0.2 | Intent summary vs commit message |

Links with confidence > 0.7 are created automatically. Lower matches flagged as orphans.

---

## 9. Security & Privacy

### 9.1 Automatic Redaction

```javascript
// Built-in redaction patterns
REDACTION_PATTERNS = [
  // API Keys
  { pattern: /sk-[a-zA-Z0-9]{32,}/g,
    replacement: '[REDACTED:API_KEY]' },
  // Passwords
  { pattern: /password["\s:=]+["']?[^\s"']+/gi,
    replacement: '[REDACTED:PASSWORD]' },
  // Tokens
  { pattern: /Bearer\s+[\w-]+/g,
    replacement: 'Bearer [REDACTED:TOKEN]' },
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: '[REDACTED:AWS_KEY]' },
  // Credit cards
  { pattern: /\d{16}/g,
    replacement: '[REDACTED:CARD]' },
]
```

### 9.2 Privacy Modes

| Mode | Prompts | Intents | Git Tracked | Use Case |
|------|---------|---------|-------------|----------|
| full | Stored as-is | Full | Yes | Solo dev |
| redacted | Secrets masked | Full | Yes | Team default |
| minimal | Not stored | Category only | Yes | High security |
| local_only | Stored | Full | No | Enterprise |

### 9.3 Enterprise Mode

```bash
$ ctx init --enterprise

✓ Privacy mode: redacted
✓ Intent log: local only (not git tracked)
✓ Audit logging: enabled
✓ Retention: 90 days

Added to .gitignore:
  .context/intents/*.jsonl
  .context/.ctxd/

Only context.lock and decisions/ will be committed.
```

---

## 10. Scaling & Performance

### 10.1 Archiving Strategy

```yaml
retention:
  hot_storage: 90d      # Individual files, fast search
  warm_storage: 1y      # Aggregated by month, compressed
  cold_storage: forever # Annual archive, external
```

```
.context/
├── intents/                    # Hot: last 90 days
│   └── 2026-02/*.jsonl
├── archive/                    # Warm: compressed
│   ├── 2025-Q4.jsonl.gz
│   └── 2025-Q3.jsonl.gz
└── .archive-pointer            # Cold: external reference
```

```bash
$ ctx archive --older-than 90d
✓ Archived 12,450 entries
✓ Reduced .context/ size by 78%
```

### 10.2 Search Index

```
.context/.ctxd/
└── search.db          # SQLite index (gitignored)
```

```bash
# Rebuilt on clone or when needed
$ ctx rebuild-index

# Fast full-text search
$ ctx search "redis session" --since 30d
Found 23 matches in 0.12s
```

### 10.3 Context Budget Management

```yaml
agent:
  context_budget:
    total_tokens: 4000
    allocation:
      project: 200       # Always included
      stack: 200         # Always included
      constraints: 400   # Always (safety critical)
      recent: 300        # Working memory
      decisions: 1500    # Dynamic by relevance
      reserve: 1400      # For loaded ADR content
```

```javascript
// MCP Server respects budget
get_project_context(max_tokens: 2000)
// → Returns trimmed context within budget
```

---

## 11. CLI Reference

### 11.1 Daemon Control (ctxd)

| Command | Description |
|---------|-------------|
| `ctxd start` | Start background daemon |
| `ctxd stop` | Stop daemon |
| `ctxd status` | Check daemon status |
| `ctxd doctor` | Diagnose issues |
| `ctxd logs --follow` | Stream daemon logs |

### 11.2 Context Inspection (ctx)

| Command | Description |
|---------|-------------|
| `ctx log` | View recent intent log |
| `ctx log --since 7d` | Last 7 days |
| `ctx log --author alice` | Filter by author |
| `ctx blame <file>` | Why does this file exist? |
| `ctx search "query"` | Full-text search in prompts |
| `ctx decisions` | List all ADRs |
| `ctx constraints` | List active constraints |
| `ctx score` | Show context health score |

### 11.3 Context Management

| Command | Description |
|---------|-------------|
| `ctx init` | Initialize .context/ with detection |
| `ctx init --import-history` | Import Claude Code history |
| `ctx init --enterprise` | Enterprise privacy mode |
| `ctx sync` | Generate CLAUDE.md, .cursorrules |
| `ctx lock` | Regenerate context.lock |
| `ctx add decision "title"` | Create new ADR |
| `ctx add constraint "id"` | Add constraint |
| `ctx archive --older-than 90d` | Archive old entries |
| `ctx redact <entry-id>` | Remove sensitive entry |

---

## 12. File Structure

```
.context/
├── MANIFEST.md                     # Entry point (human + AI)
├── context.lock                    # Semantic snapshot
│
├── intents/                        # Per-session capture (one file per session)
│   ├── 2026-02-03_alice_abc123.jsonl
│   ├── 2026-02-03_bob_def456.jsonl
│   └── ...
│
├── decisions/                      # Architecture Decision Records
│   ├── _index.yaml                 # Decision metadata + triggers
│   ├── ADR-001.md                  # Full decision content
│   ├── ADR-002.md
│   └── ...
│
├── archive/                        # Compressed old entries
│   └── 2025-Q4.jsonl.gz
│
├── constraints.yaml                # Detailed constraints
├── glossary.yaml                   # Domain terminology
├── project.yaml                    # Full project config
│
└── .ctxd/                          # Daemon state (gitignored)
    ├── state.json
    ├── search.db                   # SQLite index
    ├── pending-inference/          # Batch queue
    └── cache/                      # LLM cache
```

### 12.1 Git Tracking Recommendations

| File/Directory | Git Tracked? | Notes |
|----------------|--------------|-------|
| context.lock | Yes | Core deliverable |
| decisions/*.md | Yes | Team knowledge |
| constraints.yaml | Yes | Critical for safety |
| glossary.yaml | Yes | Domain knowledge |
| intents/*.jsonl | Optional | May contain sensitive data |
| archive/ | Optional | Large, can use LFS |
| .ctxd/ | No | Local state only |

---

## Appendix: Quick Start Guide

### A.1 Installation

```bash
# Install CLI and daemon
npm install -g context-daemon

# Configure Claude Code retention (IMPORTANT)
echo '{"cleanupPeriodDays": 99999}' > ~/.claude/settings.json
```

### A.2 First Setup

```bash
# Initialize with historical import
cd your-project
ctx init --import-history

# Start the daemon
ctxd start

# Verify everything works
ctxd doctor
```

### A.3 Daily Usage

```bash
# Work normally with Claude Code, Cursor, etc.
# Context accumulates automatically

# Check what was captured
ctx log --since 1d

# Understand why code exists
ctx blame src/auth/session.ts

# Search past conversations
ctx search "redis performance"

# Sync context to CLAUDE.md
ctx sync

# Check context health
ctx score
```

### A.4 Team Onboarding

```bash
# New team member clones repo
git clone ...
cd project

# Rebuild local index
ctx rebuild-index

# Context is immediately available
ctx log
ctx blame src/critical-module/

# Start capturing their sessions
ctxd start
```

---

> **Context Daemon** — Because the 'why' matters as much as the 'what'.

*© 2026 Context Spec Project - MIT License*
