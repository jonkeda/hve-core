---
category: Memory
displayName: Conversation Memory
icon: codicon-database
phases:
  - id: memory
    label: Memory
    icon: codicon-database
    folder: memory/
    agent: memory
    prompt: /memory
lifecycleStates:
  - active
  - archived
instancePattern: "{{NN}}_{{MemoryName}}"
---

# Conversation Memory Workflow

This workflow defines the storage lifecycle for persistent conversation memory files tracked in `.copilot-tracking/Memory/`.

## Phase Descriptions

### Memory

Persistent memory file management for storing cross-conversation context and decisions.
