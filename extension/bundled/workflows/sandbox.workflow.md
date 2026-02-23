---
category: Sandbox
displayName: Prompt Sandbox
icon: codicon-beaker
phases:
  - id: execute
    label: Execute
    icon: codicon-terminal
    folder: execute/
    agent: prompt-builder
    prompt: /prompt-builder
  - id: evaluate
    label: Evaluate
    icon: codicon-feedback
    folder: evaluate/
lifecycleStates:
  - active
  - archived
instancePattern: "{{NN}}_{{SandboxName}}"
---

# Prompt Sandbox Workflow

This workflow defines the test-and-evaluate lifecycle for prompt testing tracked in `.copilot-tracking/Sandbox/`.

## Phase Descriptions

### Execute

Prompt execution in a sandboxed environment with controlled inputs and outputs.

### Evaluate

Evaluation of prompt outputs against quality criteria and expected behaviors.
