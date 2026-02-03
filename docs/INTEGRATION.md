# AI Tool Integration Guide

How to add CTX Spec support to your AI coding tool.

## Overview

Supporting CTX Spec is straightforward:

1. **Detect** `.ctx/` directory
2. **Load** relevant files
3. **Inject** into context
4. **Respect** constraints

## Detection

Check for `.ctx/` directory starting from:
1. Current working directory
2. Git repository root
3. Parent directories (stop at filesystem root)

```javascript
function findCtxDir(startPath) {
  let current = startPath;
  while (current !== '/') {
    const ctxPath = path.join(current, '.ctx');
    if (fs.existsSync(ctxPath)) {
      return ctxPath;
    }
    // Stop at git root
    if (fs.existsSync(path.join(current, '.git'))) {
      return null;
    }
    current = path.dirname(current);
  }
  return null;
}
```

## Loading Strategy

### Always Load
- `project.yaml` — Core project context
- `constraints.yaml` — Rules to enforce

### Load On Demand
- `intent.md` — If modified within last 7 days
- `architecture.md` — On session start or explicit request
- `glossary.yaml` — When domain terms appear in conversation
- `modules/*.yaml` — Based on files being edited

### Smart Loading

```javascript
function getRelevantContext(ctxDir, activeFiles) {
  const context = {};
  
  // Always load core
  context.project = loadYaml(`${ctxDir}/project.yaml`);
  context.constraints = loadYaml(`${ctxDir}/constraints.yaml`);
  
  // Load intent if fresh
  const intentPath = `${ctxDir}/intent.md`;
  if (isRecentlyModified(intentPath, 7 * 24 * 60 * 60 * 1000)) {
    context.intent = loadMarkdown(intentPath);
  }
  
  // Load relevant modules
  for (const file of activeFiles) {
    const moduleName = detectModule(file);
    const modulePath = `${ctxDir}/modules/${moduleName}.yaml`;
    if (fs.existsSync(modulePath)) {
      context.modules = context.modules || {};
      context.modules[moduleName] = loadYaml(modulePath);
    }
  }
  
  return context;
}
```

## Context Injection

### System Prompt

```
You are an AI coding assistant working on {project.name}.

{project.description}

## Tech Stack
{project.stack.join(', ')}

## Instructions
{project.ai_instructions}

## RULES (Must Follow)
{constraints.rules.map(r => `- ${r}`).join('\n')}

## FORBIDDEN (Never Do)
{constraints.forbidden.map(f => `- ${f}`).join('\n')}
```

### User Context (per-message)

```
## Current Focus
{intent.content}

## Relevant Module: {module.name}
{module.description}
Pitfalls: {module.pitfalls.join(', ')}
```

## Enforcing Constraints

### Pre-generation Check

Before generating code, check if request might violate constraints:

```javascript
function checkConstraints(request, constraints) {
  const warnings = [];
  
  // Check forbidden patterns
  for (const forbidden of constraints.forbidden) {
    if (requestMightViolate(request, forbidden)) {
      warnings.push(`This might violate: ${forbidden}`);
    }
  }
  
  return warnings;
}
```

### Post-generation Validation

After generating code, validate against constraints:

```javascript
function validateOutput(code, constraints) {
  const violations = [];
  
  // Check forbidden patterns in generated code
  for (const pattern of constraints.forbidden_patterns || []) {
    if (code.includes(pattern)) {
      violations.push(`Contains forbidden pattern: ${pattern}`);
    }
  }
  
  return violations;
}
```

## Export Format

For tools that can't read `.ctx/` directly, the CLI provides export:

```bash
ctx export --format markdown > context.md
ctx export --format json > context.json
```

### Markdown Export

```markdown
# Project: my-app

## Description
E-commerce platform...

## AI Instructions
- Use Composition API...

## Constraints
### Rules
- All functions must have return types

### Forbidden
- Never use any type

## Current Intent
Optimizing checkout...
```

### JSON Export

```json
{
  "ctx_version": "0.1",
  "project": {
    "name": "my-app",
    "description": "...",
    "ai_instructions": "..."
  },
  "constraints": {
    "rules": [...],
    "forbidden": [...]
  },
  "intent": "..."
}
```

## Testing Your Integration

Use the example project to test:

```bash
git clone https://github.com/zepgram/ctx-spec
cd ctx-spec/examples/basic
# Your tool should detect .ctx/ and load context
```

## Badge

Show CTX Spec support in your tool:

```markdown
[![CTX Spec](https://img.shields.io/badge/CTX%20Spec-supported-blue)](https://github.com/zepgram/ctx-spec)
```

## Questions?

- Open an issue: https://github.com/zepgram/ctx-spec/issues
- Discussions: https://github.com/zepgram/ctx-spec/discussions
