---
category: ADR
displayName: Architecture Decision
icon: codicon-symbol-structure
phases:
  - id: draft
    label: Draft
    icon: codicon-edit
    folder: draft/
    agent: adr-creation
    prompt: /adr-creation
  - id: finalize
    label: Finalize
    icon: codicon-check
    folder: finalize/
lifecycleStates:
  - active
  - archived
instancePattern: "{{NN}}_{{ADRName}}"
---

# Architecture Decision Record Workflow

This workflow defines the draft-to-finalize lifecycle for architecture decision records tracked in `.copilot-tracking/ADR/`.

## Phase Descriptions

### Draft

ADR drafting with context, decision drivers, considered options, and outcome rationale.

### Finalize

Final review and approval of the architecture decision record with stakeholder sign-off.
