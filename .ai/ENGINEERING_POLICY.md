# Loadder AI Engineering Policy

## Purpose

This document defines the engineering workflow for AI agents working on Loadder.

The goal is to preserve architecture integrity, reduce regression risk, and make feature development predictable.

---

# Feature Development Protocol

Before implementing any major feature:

## Step 1 - Architecture Discovery

Use Graphify MCP first.

Analyze:

- affected communities
- dependency paths
- composition roots
- critical services
- possible breaking points

Do not start coding before impact analysis.

---

## Step 2 - Architecture Report

Create an impact report containing:

- Feature scope
- Affected modules
- Risk level
- Files requiring inspection
- Test coverage impact
- Recommended implementation order

---

## Step 3 - Source Inspection

Only inspect source files identified by architecture analysis.

Avoid unnecessary repository exploration.

---

## Step 4 - Implementation Rules

When modifying core services:

- preserve existing contracts
- avoid breaking composition roots
- maintain backward compatibility where possible
- update tests with implementation

---

## Step 5 - Validation

Every major change requires:

- backend tests
- frontend validation
- browser flow validation when applicable
- regression check

---

# Protected Domains

Extra caution required:

- payment
- checkout
- order lifecycle
- financial ledger
- authentication
- merchant capability contracts

---

# Agent Behavior

AI agents must:

1. Understand before modifying.
2. Prefer minimal changes.
3. Avoid unnecessary refactoring.
4. Explain architectural impact before coding.
5. Preserve existing successful flows.
