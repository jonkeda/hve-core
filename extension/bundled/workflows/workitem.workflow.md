---
category: WorkItem
displayName: ADO Work Item
icon: codicon-tasklist
phases:
  - id: analyze
    label: Analyze
    icon: codicon-search
    folder: analyze/
    agent: ado-prd-to-wit
    prompt: /ado-prd-to-wit
  - id: discover
    label: Discover
    icon: codicon-telescope
    folder: discover/
  - id: refine
    label: Refine
    icon: codicon-edit
    folder: refine/
  - id: finalize
    label: Finalize
    icon: codicon-check
    folder: finalize/
  - id: execute
    label: Execute
    icon: codicon-run
    folder: execute/
lifecycleStates:
  - active
  - paused
  - archived
instancePattern: "{{NN}}_{{WorkItemName}}"
---

# ADO Work Item Workflow

This workflow defines the discovery and planning lifecycle for Azure DevOps work items tracked in `.copilot-tracking/WorkItem/`.

## Phase Descriptions

### Analyze

PRD-to-WIT analysis that maps product requirements to work item structures.

### Discover

Work item discovery across Azure DevOps projects and boards.

### Refine

Refinement of discovered work items with acceptance criteria and estimates.

### Finalize

Final review and approval of work item definitions before creation.

### Execute

Execution of work item creation and update operations via ADO APIs.
