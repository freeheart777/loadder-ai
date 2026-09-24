# Loadder Architecture Review Skill

## Purpose

Ensure every major Loadder feature starts with architecture analysis.

## Mandatory Workflow

Before modifying code:

1. Use Graphify MCP.
2. Identify affected communities.
3. Identify dependency paths.
4. Identify composition roots.
5. Identify possible breaking points.
6. Produce an Architecture Impact Report.

## Protected Areas

Extra analysis required for:

- payment
- checkout
- orders
- ledger
- authentication
- merchant capabilities

## Rules

Never start implementation before impact analysis.

Prefer:
- minimal changes
- backward compatibility
- existing service patterns

Avoid:
- unnecessary refactoring
- duplicate services
- bypassing existing contracts

## Output Format

Every review should include:

Feature:
Scope:

Affected Communities:

Critical Paths:

Risk Level:

Breaking Points:

Files To Inspect:

Implementation Order:
