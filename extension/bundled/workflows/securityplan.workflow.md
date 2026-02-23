---
category: SecurityPlan
displayName: Security Plan
icon: codicon-shield
phases:
  - id: plan
    label: Plan
    icon: codicon-shield
    folder: plan/
    agent: security-plan-creator
    prompt: /security-plan-creator
  - id: output
    label: Output
    icon: codicon-file-text
    folder: output/
lifecycleStates:
  - active
  - archived
instancePattern: "{{NN}}_{{PlanName}}"
---

# Security Plan Workflow

This workflow defines the planning lifecycle for security plans tracked in `.copilot-tracking/SecurityPlan/`.

## Phase Descriptions

### Plan

Security threat modeling, risk assessment, and mitigation strategy development.

### Output

Finalized security plan documents with controls, policies, and implementation guidance.
