---
category: 'Instruction Generation'
description: "Analyze source code and propose instruction files for selection - Brought to you by microsoft/hve-core"
agent: 'instruction-analyzer'
argument-hint: "topic=... [sourceFolders=folder1,folder2] [chat={true|false}]"
maturity: stable
---

# Instruction Files From Source

Use this prompt to start an analysis-first workflow that proposes instruction files from source code patterns before any generation work begins.

## Inputs

* ${input:topic}: (Required) Primary topic, capability, or area to analyze.
* ${input:sourceFolders}: (Optional) Comma-separated source folders to prioritize. Defaults to repository-relevant folders.
* ${input:chat:true}: (Optional, defaults to true) Include current conversation context.

## Required Steps

**Important requirements**, repeat to yourself these important requirements:

* **Important**, always be thorough and accurate.
* Score proposals based on actual evidence from source folders rather than assumptions.
* Stop after analysis and proposal generation; do not generate instruction files in this workflow.

### Step 1: Resolve Inputs and Scope

* Resolve `topic`, `sourceFolders`, and `chat` from user input and conversation context.
* Keep source analysis scoped to the requested topic and selected folders.
* Carry unresolved assumptions into a clarification section instead of guessing.

### Step 2: Collect Evidence and Build Proposals

* Search source folders for naming, type, and behavior signals matching the topic.
* Scan `.github/instructions/` for existing instruction files whose scope overlaps with proposed candidates.
* For overlapping files, propose a `merge` action instead of `create` and include the existing file path as `mergeTarget`.
* Score each candidate instruction file with confidence based on evidence strength.
* Group proposals by language and framework with checklist output for user selection.

### Step 3: Return Selection-Ready Output

* Return the generated proposal checklist path in `.copilot-tracking/questions/`.
* Summarize detected groups, confidence distribution, and items needing clarification.
* Stop after analysis and proposal generation, waiting for explicit selection before any generation flow.

---

Proceed with the user's request following the Required Steps.
