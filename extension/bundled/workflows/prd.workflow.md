---
category: PRD
displayName: Product Requirements
icon: codicon-package
phases:
  - id: session
    label: Session
    icon: codicon-notebook
    folder: session/
    agent: prd-builder
    prompt: /prd-builder
lifecycleStates:
  - active
  - archived
instancePattern: "{{NN}}_{{PRDName}}"
---

# Product Requirements Workflow

This workflow defines the session lifecycle for product requirements documents tracked in `.copilot-tracking/PRD/`.

## Phase Descriptions

### Session

Interactive PRD building session that transforms business requirements into detailed product specifications with user stories and acceptance criteria.
