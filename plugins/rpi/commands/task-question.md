---
description: "Defines research questions through interactive task-list documents before invoking task-researcher - Brought to you by microsoft/hve-core"
agent: 'task-question'
maturity: experimental
---

# Task Question

## Inputs

* ${input:chat:true}: (Optional, defaults to true) Include conversation context for question generation
* ${input:topic}: (Required) Primary topic or focus area

## Required Steps

### Step 1: Assess Input

Analyze user input and conversation context:

* Extract the primary topic from ${input:topic} or conversation.
* Check `.copilot-tracking/questions/` for an existing question document matching the topic.
* Resume from existing document when found.

### Step 2: Generate Questions

Create or extend the question document:

* Write to `.copilot-tracking/questions/{{YYYY-MM-DD}}-<topic>-questions.md`.
* Generate thematic question groups with task-list proposed answers.
* Generate as many questions as the topic requires.
* Inform the user the document is ready for review.

### Step 3: Iterate

Refine questions based on user answers:

* Read the question document for checked answers.
* Append follow-up questions in a new round section.
* Repeat until either party declares questioning sufficient.
* Generate the research brief and hand off to task-researcher.

---

Invoke task-question mode and proceed with the Required Steps.
