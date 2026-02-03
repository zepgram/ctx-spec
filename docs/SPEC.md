# CTX Spec v0.1

> Context Infrastructure for AI Coding

## Overview

CTX Spec defines a standard directory structure (`.ctx/`) that AI coding tools can read to understand project context. It's designed to be:

- **Simple** — Plain YAML/Markdown files
- **Portable** — Any tool can implement it
- **Git-native** — Versioned with your code
- **Incremental** — Start with one file, add more as needed

## Directory Structure

```
.ctx/
├── project.yaml       # [REQUIRED] Project metadata
├── constraints.yaml   # Rules and boundaries
├── architecture.md    # System design
├── glossary.yaml      # Domain terminology
├── intent.md          # Current focus
└── modules/           # Per-module context (optional)
    ├── checkout.yaml
    └── inventory.yaml
```

## File Specifications

### project.yaml (Required)

The only required file. Contains project metadata and basic AI instructions.

```yaml
# CTX Spec version
ctx_version: "0.1"

# Project info
name: "my-project"
description: "Short description of the project"

# Tech stack (helps AI understand the ecosystem)
stack:
  - nuxt3
  - typescript
  - postgresql
  - redis

# Primary language
language: typescript

# AI-specific instructions (injected into system prompt)
ai_instructions: |
  - Use Composition API with <script setup>
  - All API calls go through /src/api/client.ts
  - Follow existing patterns before inventing new ones
  - When unsure, check /docs/ first

# Optional: paths AI should always be aware of
key_paths:
  - src/api/          # API layer
  - src/composables/  # Shared logic
  - src/types/        # Type definitions
```

### constraints.yaml

Hard rules the AI must follow. These are non-negotiable.

```yaml
# Things AI must always do
rules:
  - All functions must have TypeScript return types
  - Use named exports, not default exports
  - Components must have Props interface defined
  - API errors must be handled with try/catch

# Things AI must never do
forbidden:
  - Never use `any` type without explicit comment
  - Never commit console.log in production code
  - Never access database directly from components
  - Never hardcode secrets or API keys

# Performance constraints
performance:
  - LCP must stay under 3 seconds
  - Bundle size must stay under 200kb
  - No synchronous operations in render path

# Security constraints  
security:
  - All user input must be sanitized
  - All API routes require authentication (except /public/*)
  - PII must be encrypted at rest
```

### architecture.md

Human-readable system design. Markdown format for flexibility.

```markdown
# Architecture

## Overview
E-commerce platform built on Nuxt 3 with headless CMS backend.

## Modules

### Checkout (`/src/modules/checkout/`)
Handles cart → payment → order flow.
- Owner: payments-team
- Dependencies: inventory, pricing
- ⚠️ Legacy v1 API still used by mobile app

### Inventory (`/src/modules/inventory/`)
Stock management and availability.
- Owner: platform-team
- Real-time sync with warehouse system

## Data Flow
```
User → Nuxt App → API Gateway → Microservices → PostgreSQL
                              → Redis (cache)
                              → Stripe (payments)
```

## Key Decisions
- **Why Nuxt 3?** SSR for SEO, Vue ecosystem familiarity
- **Why PostgreSQL?** ACID compliance for transactions
- **Why separate modules?** Team ownership boundaries
```

### glossary.yaml

Domain-specific terms. Helps AI understand business context.

```yaml
terms:
  SKU:
    definition: Stock Keeping Unit - unique product identifier
    example: "ZV-DRESS-BLK-M"
    
  AOV:
    definition: Average Order Value
    formula: total_revenue / number_of_orders
    context: Key metric for marketing team
    
  Click & Collect:
    definition: Buy online, pickup in store
    aliases: [BOPIS, C&C]
    
  Flash Sale:
    definition: Time-limited discount event
    constraints: 
      - Max 48h duration
      - Requires inventory lock
      - Needs marketing approval
```

### intent.md

Current working context. Updated frequently.

```markdown
# Current Intent

## Active Focus
Optimizing checkout page performance. Target: LCP < 2.5s

## Recent Context
- Just finished payment provider migration (Stripe → Adyen)
- Cart component was refactored last week
- Known issue: slow inventory check on large carts

## Blocked On
- Waiting for design review on new progress indicator
- Need API team to expose batch inventory endpoint

## Next Up
- [ ] Lazy load payment form
- [ ] Implement skeleton loaders
- [ ] Add performance monitoring
```

### modules/*.yaml (Optional)

Per-module context for larger projects.

```yaml
# .ctx/modules/checkout.yaml
name: checkout
path: src/modules/checkout
owner: payments-team
description: Handles cart → payment → order flow

dependencies:
  - inventory  # Stock checks
  - pricing    # Discounts, taxes

exposes:
  - POST /api/checkout/create
  - POST /api/checkout/complete
  - GET /api/checkout/:id

consumes:
  - inventory.checkStock()
  - pricing.calculateTotal()

pitfalls:
  - Legacy v1 API at /src/legacy/ still serves mobile app
  - Test mode hits real Stripe sandbox (charges appear then void)
  - Cart expiry is 30 minutes, not configurable yet
```

## AI Tool Integration

### Detection

Tools should check for `.ctx/` directory at:
1. Repository root
2. Current working directory
3. Parent directories (up to git root)

### Loading Priority

1. `project.yaml` (always load)
2. `constraints.yaml` (always load if exists)
3. `intent.md` (load if recent, < 7 days old)
4. `architecture.md` (load on first session or when requested)
5. `glossary.yaml` (load when domain terms appear)
6. `modules/*.yaml` (load relevant modules based on file context)

### Context Injection

Recommended approach:

```
System prompt:
- Include project.yaml ai_instructions
- Include constraints as "RULES YOU MUST FOLLOW"
- Include relevant module context based on files being edited

User context:
- Include intent.md as "CURRENT FOCUS"
- Include glossary terms when domain language appears
```

### Respecting Constraints

Constraints in `constraints.yaml` should be treated as hard rules:
- `rules` → Must always follow
- `forbidden` → Must never do
- `performance` → Warn if likely to violate
- `security` → Block if violating

## Migration

### From .cursorrules

```bash
ctx migrate --from cursor
```

Converts `.cursorrules` content into `.ctx/project.yaml` ai_instructions.

### From CLAUDE.md / AGENTS.md

```bash
ctx migrate --from claude
```

Parses existing markdown files and distributes into appropriate `.ctx/` files.

## Versioning

The spec follows semver:
- `0.x` — Experimental, breaking changes possible
- `1.x` — Stable, backwards compatible
- `2.x` — Breaking changes, migration guide provided

Files include `ctx_version` to indicate which spec version they follow.

## Future Considerations (v0.2+)

- **Intent log**: Append-only log of intent → code changes
- **Remote sync**: Team-shared context (CTX Cloud)
- **Hooks**: Events for context changes
- **Inheritance**: Org-level defaults + project overrides

---

*CTX Spec v0.1 — Draft*
*Last updated: 2026-02-03*
