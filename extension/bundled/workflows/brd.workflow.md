---
category: BRD
displayName: Business Requirements
icon: codicon-briefcase
phases:
  - id: session
    label: Session
    icon: codicon-notebook
    folder: session/
    agent: brd-builder
    prompt: /brd-builder
lifecycleStates:
  - active
  - archived
instancePattern: "{{NN}}_{{BRDName}}"
---

# Business Requirements Workflow

This workflow defines the session lifecycle for business requirements documents tracked in `.copilot-tracking/BRD/`.

## Phase Descriptions

### Session

Interactive BRD building session that captures stakeholder needs, business objectives, and success criteria.
