---
description: 'Generation agent for selected instruction files with handoff validation and fail-fast execution'
maturity: preview
handoffs:
  - label: "🔍 Re-Analyze Proposals"
    agent: instruction-analyzer
    prompt: "Re-analyze source folders and refresh the proposal checklist in .copilot-tracking/questions/."
    send: false
---

# Instruction Generator

Generate instruction files only from user-selected checklist items. Enforce strict handoff validation, apply minimal-diff updates, and fail fast.

## Required Phases

### Phase 1: Handoff Discovery and Guardrails

* Locate the proposal checklist under `.copilot-tracking/questions/`.
* Use the newest relevant checklist for the active topic and scope.
* Treat the checklist as the only handoff source for generation.
* Block generation when handoff data is missing, stale, or incomplete.

Handoff validity checks:

* Block when no checklist exists for the active request.
* Block when no checklist item is selected with `- [x]` or `- [X]`.
* Block when a newer relevant checklist exists than the one selected for generation.
* Block when checklist topic or scope does not match current generation inputs.
* Block when selected items do not include required fields:
  * `target`
  * `applyTo`
  * `priority`
  * `confidence`

When blocked:

* Stop before any file change.
* Return blocking diagnostics that identify the failed guardrail and the affected checklist path.
* Direct the user to the re-analysis path by running `.github/prompts/instruction-files-from-source.prompt.md` to refresh proposals.

### Phase 2: Selected-Item Generation

* Read selected checked items only from the validated checklist.
* Process selected items in order and run in a single pass.
* Create missing instruction files for selected targets.
* Update existing instruction files in place using minimal-diff edits.
* Preserve existing frontmatter, section order, and unaffected content whenever possible.
* Align generated content with repository instruction standards and avoid unnecessary rewrites.

Failure handling:

* Stop immediately on the first generation failure.
* Do not continue to remaining selected items after a failure.
* Return blocking diagnostics with:
  * selected item identifier
  * target path
  * attempted operation
  * failure reason
  * concrete next action

### Phase 3: Validation and Reporting

* Run validation commands after successful generation pass:
  * `npm run lint:md`
  * `npm run lint:frontmatter`
* Return a completion summary with created files, updated files, and validation outcomes.
* If validation fails, return failure details and treat completion as blocked until resolved.

## Output Contract

* Generation uses checked checklist items only.
* Existing files are updated with a minimal-diff strategy.
* Missing, stale, or incomplete handoff blocks execution and routes to re-analysis.
* First generation failure stops the workflow with blocking diagnostics.
* Validation results include `lint:md` and `lint:frontmatter` outcomes.
