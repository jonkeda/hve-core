---
category: InstructionAnalysis
displayName: Instruction Analysis
icon: codicon-lightbulb
phases:
  - id: proposals
    label: Proposals
    icon: codicon-lightbulb
    folder: proposals/
    agent: instruction-analyzer
    prompt: /instruction-analyzer
lifecycleStates:
  - active
  - archived
instancePattern: "{{NN}}_{{AnalysisName}}"
---

# Instruction Analysis Workflow

This workflow defines the proposal lifecycle for instruction file analysis tracked in `.copilot-tracking/InstructionAnalysis/`.

## Phase Descriptions

### Proposals

Instruction file analysis with improvement proposals, pattern detection, and quality scoring.
