---
category: GitHubIssue
displayName: GitHub Issue
icon: codicon-issues
phases:
  - id: discover
    label: Discover
    icon: codicon-telescope
    folder: discover/
    agent: github-backlog-manager
    prompt: /github-backlog-manager
  - id: triage
    label: Triage
    icon: codicon-filter
    folder: triage/
  - id: plan
    label: Plan
    icon: codicon-checklist
    folder: plan/
  - id: execute
    label: Execute
    icon: codicon-run
    folder: execute/
lifecycleStates:
  - active
  - archived
instancePattern: "{{NN}}_{{IssueName}}"
---

# GitHub Issue Workflow

This workflow defines the backlog management lifecycle for GitHub issues tracked in `.copilot-tracking/GitHubIssue/`.

## Phase Descriptions

### Discover

Issue discovery across repositories using search, assignment, and artifact-driven strategies.

### Triage

Issue triage with label suggestion, milestone assignment, and duplicate detection.

### Plan

Backlog planning with priority ordering, sprint assignment, and dependency mapping.

### Execute

Issue creation, update, and closure operations via GitHub APIs.
