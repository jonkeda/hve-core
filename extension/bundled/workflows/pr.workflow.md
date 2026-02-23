---
category: PR
displayName: Pull Request
icon: codicon-git-pull-request
phases:
  - id: reference
    label: Reference
    icon: codicon-references
    folder: reference/
  - id: description
    label: Description
    icon: codicon-file-text
    folder: description/
  - id: analysis
    label: Analysis
    icon: codicon-search
    folder: analysis/
  - id: reviewer
    label: Reviewer
    icon: codicon-person
    folder: reviewer/
  - id: handoff
    label: Handoff
    icon: codicon-arrow-right
    folder: handoff/
    agent: pr-review
    prompt: /pr-review
lifecycleStates:
  - active
  - archived
instancePattern: "{{NN}}_{{PRName}}"
---

# Pull Request Workflow

This workflow defines the review and creation lifecycle for pull requests tracked in `.copilot-tracking/PR/`.

## Phase Descriptions

### Reference

PR reference generation with diff analysis and commit summaries.

### Description

PR description authoring with template compliance and context linking.

### Analysis

Code analysis covering quality, security, and standards compliance.

### Reviewer

Reviewer identification and assignment from code ownership data.

### Handoff

Final review handoff with approval status and merge readiness assessment.
