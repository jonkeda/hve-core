---
category: Task
displayName: RPI Task
icon: codicon-list-tree
phases:
  - id: questions
    label: Questions
    icon: codicon-question
    folder: questions/
    agent: task-question
    prompt: /task-question
  - id: research
    label: Research
    icon: codicon-beaker
    folder: research/
    agent: task-researcher
    prompt: /task-research
    branches:
      - id: decide
        label: Decide
        icon: codicon-law
        prompt: /task-decide
        agent: task-researcher
  - id: plans
    label: Plan
    icon: codicon-checklist
    folder: plans/
    agent: task-planner
    prompt: /task-plan
  - id: changes
    label: Implement
    icon: codicon-code
    folder: changes/
    agent: task-implementor
    prompt: /task-implement
  - id: reviews
    label: Review
    icon: codicon-eye
    folder: reviews/
    agent: task-reviewer
    prompt: /task-review
    feedbackTo:
      - research
      - plans
auxiliaryFolders:
  - id: subagent
    label: Subagent Research
    folder: subagent/
  - id: details
    label: Details
    folder: details/
lifecycleStates:
  - active
  - paused
  - archived
instancePattern: "{{NN}}_{{TaskName}}"
---

# RPI Task Workflow

This workflow defines the Research-Plan-Implement lifecycle for tasks tracked in `.copilot-tracking/Task/`.

## Phase Descriptions

### Questions

Pre-research question framing. The task-question agent generates question documents with checkbox answers and produces a research brief as handoff.

### Research

Deep analysis producing a single authoritative research document with alternatives analysis and pre-selected decisions. Can branch to Decide for decision arbitration.

### Plan

Implementation planning that transforms research findings into actionable step-by-step plans with phase parallelization.

### Implement

Code changes guided by the plan. Creates change logs tracking modifications.

### Review

Quality review of implementation against plan and research criteria. Can feed back to Research or Plan for corrections.
