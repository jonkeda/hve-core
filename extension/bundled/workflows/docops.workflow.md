---
category: DocOps
displayName: Documentation Ops
icon: codicon-book
phases:
  - id: session
    label: Session
    icon: codicon-book
    folder: session/
    agent: doc-ops
    prompt: /doc-ops
lifecycleStates:
  - active
  - archived
instancePattern: "{{NN}}_{{DocOpsName}}"
---

# Documentation Operations Workflow

This workflow defines the session lifecycle for documentation operations tracked in `.copilot-tracking/DocOps/`.

## Phase Descriptions

### Session

Documentation operations session covering content audits, style enforcement, link validation, and documentation restructuring.
