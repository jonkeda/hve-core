---
title: Workflow Discovery Questions
description: Template for structured discovery questions when creating a new workflow
---

## Workflow Identity

* [ ] **ID:** [kebab-case workflow identifier]
* [ ] **Display Name:** [human-readable workflow name]
* [ ] **Problem Statement:** [what problem does this workflow solve?]
* [ ] **Target User:** [who uses this workflow?]

## Workflow Triggers

* {{triggerPhrase1}}
* {{triggerPhrase2}}
* {{triggerPhrase3}}

## Workflow Phases

**Number of phases:** {{phaseCount}}

* [ ] Document
* [ ] Discover
* [ ] Analyze
* [ ] Design
* [ ] Review
* [ ] Implement
* [ ] Verify
* [ ] Close
* [ ] Other: [describe]

## Phase Details

### Phase: {{phaseName}}

* **Description:** {{phaseDescription}}
* **Output template needed:** [yes/no]
* **Output file pattern:** {{outputFilePattern}}

## Workflow Behavior

* [ ] **Sequential:** [yes/no — must phases run in order?]
* [ ] **Concurrent phases:** [yes/no — can any phases run in parallel?]

## Output Configuration

* **Tracking category:** {{trackingCategory}}
* **Continue commands:** {{continueCommands}}

## Generation Checklist

* [ ] All phases defined with descriptions
* [ ] Output templates identified for each phase
* [ ] Trigger phrases finalized
* [ ] Phase transitions documented
* [ ] Workflow behavior confirmed
