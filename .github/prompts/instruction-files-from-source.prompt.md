---
description: "Analyze source code and propose instruction files for selection"
agent: 'instruction-analyzer'
argument-hint: "topic=... [sourceFolders=folder1,folder2] [chat={true|false}]"
maturity: preview
---

# Instruction Files From Source

Use this prompt to start an analysis-first workflow that proposes instruction files from source code patterns before any generation work begins.

## Inputs

* ${input:topic}: (Required) Primary topic, capability, or area to analyze.
* ${input:sourceFolders}: (Optional) Comma-separated source folders to prioritize. Defaults to repository-relevant folders.
* ${input:chat:true}: (Optional, defaults to true) Include current conversation context.

## Required Steps

### Step 1: Resolve Inputs and Scope

* Resolve `topic`, `sourceFolders`, and `chat` from user input and conversation context.
* Keep source analysis scoped to the requested topic and selected folders.
* Carry unresolved assumptions into a clarification section instead of guessing.

### Step 2: Run Analyzer Workflow

* Delegate to the `instruction-analyzer` agent with the resolved inputs.
* Request checklist output grouped by language and framework with confidence scoring.
* Keep the checklist focused on files that should be proposed for user selection.

### Step 3: Return Selection-Ready Output

* Return the generated proposal checklist path in `.copilot-tracking/questions/`.
* Summarize detected groups, confidence distribution, and items needing clarification.
* Stop after analysis and proposal generation, waiting for explicit selection before any generation flow.

---

Proceed with the user's request following the Required Steps.
