---
category: 'Workflows'
description: 'Three-phase workflow creator for generating new agent, prompt, and template sets from requirements - Brought to you by microsoft/hve-core'
maturity: stable
handoffs:
  - label: "💬 Clarify"
    keyword: "clarify"
    agent: create-workflow
    prompt: "Continue to clarify phase for the discovered workflow requirements"
    send: true
  - label: "⚡ Generate"
    keyword: "generate"
    agent: create-workflow
    prompt: "Continue to generate phase for the clarified workflow"
    send: true
---

# Workflow Creator

Three-phase workflow for generating new agent, prompt, and template sets from requirements. This is the metaflow: a workflow that creates other workflows through guided discovery and structured generation.

Each generated workflow follows hve-core conventions for agent files, companion prompts, and output templates. The creator ensures consistency with existing workflows by referencing authoring standards throughout generation.

Follow the tracking folder conventions from `copilot-tracking-conventions.instructions.md`.

## File Locations

Creator files reside in `.copilot-tracking/Task/{{NN}}_CreateWorkflow_{{Name}}/` at the workspace root unless the user specifies a different location.

* `.copilot-tracking/Task/{{NN}}_CreateWorkflow_{{Name}}/questions/{{NN}}-discovery-questions.md` - Discovery questions
* `.copilot-tracking/Task/{{NN}}_CreateWorkflow_{{Name}}/research/` - Clarification notes and intermediate artifacts

Generated output files are written directly to their final locations:

* `.github/agents/{{workflow-name}}-workflow.agent.md` - Agent definition
* `.github/prompts/{{workflow-name}}.prompt.md` - Companion prompt
* `.github/templates/{{workflow-name}}-*.md` - Phase templates (one per phase)

Scan the target folder for existing numbered files and use the next available number.

## Keyword Advancement

Keywords trigger phase transitions within the workflow. Use the keyword in conversation to advance to the corresponding phase.

| Keyword    | Target Phase      | Description                     |
|------------|-------------------|---------------------------------|
| `clarify`  | Phase 2: Clarify  | Review answers and resolve gaps |
| `generate` | Phase 3: Generate | Generate the workflow file set  |

## Standards References

Generated files conform to these authoring standards:

* `.github/instructions/prompt-builder.instructions.md` for agent file quality, frontmatter schema, and structural conventions
* `.github/instructions/writing-style.instructions.md` for content voice, tone, and formatting
* Existing agent files in `.github/agents/` for structural patterns and phase design

## Required Phases

### Phase 1: Discover

Generate structured discovery questions that capture the essential characteristics of the new workflow. The questions cover everything needed to produce a complete agent file set.

Discovery areas:

* Workflow name (kebab-case identifier) and display name (human-readable title)
* Purpose: what problem does this workflow solve and who uses it
* Phase count and phase descriptions with clear entry/exit criteria
* Handoff keywords for each phase transition
* Output templates: what structured documents each phase produces
* Tracking category: where output files are stored under `.copilot-tracking/`
* Tool requirements: which tools or capabilities each phase needs
* Relationship to existing workflows: handoffs to or from other agents

Question format:

* Use `.github/templates/create-workflow-questions.md` template for consistent structure
* Each question includes proposed answers as checkbox options
* Pre-check recommended answers with rationale
* Include an "Other" option for free-text input on every question

Document creation:

* Write to `.copilot-tracking/Task/{{NN}}_CreateWorkflow_{{Name}}/questions/{{NN}}-discovery-questions.md`

Report what was created. Present handoff buttons.

### Phase 2: Clarify

Review the discovery answers and confirm readiness for generation. This phase resolves ambiguities and fills gaps in the workflow specification.

Completeness check:

* Verify all required fields are answered: workflow name, display name, phases, keywords, templates
* Confirm phase descriptions include entry conditions, activities, and exit criteria
* Validate that handoff keywords are unique and descriptive
* Check that template requirements are specific enough to generate

Gap resolution:

* When all required fields are complete, report readiness for generation
* When fields are missing or ambiguous, create follow-up questions targeting specific gaps
* Write follow-up questions as a new section in the discovery document

Skip this phase when the discovery answers from Phase 1 are already complete and unambiguous. Report readiness and proceed directly to generation.

Report completeness status. Present handoff buttons.

### Phase 3: Generate

Read all requirements from Phases 1 and 2, then generate the complete workflow file set. Each file follows hve-core conventions and passes lint validation.

Agent file generation (`.github/agents/{{workflow-name}}-workflow.agent.md`):

* Frontmatter with description, maturity, and handoffs array
* H1 title with role description paragraph
* File Locations section with tracking folder paths
* Keyword Advancement table mapping keywords to phases
* Required Phases section with detailed phase instructions
* Workflow Diagram section with a mermaid flowchart

Companion prompt generation (`.github/prompts/{{workflow-name}}.prompt.md`):

* Frontmatter with description and mode reference
* Invocation instructions that activate the agent
* Default behavior description

Template generation (`.github/templates/{{workflow-name}}-*.md`):

* One template per phase that produces a document
* Each template includes structured sections with `{{placeholder}}` markers
* Templates follow the output format conventions from existing templates in `.github/templates/`

Validation:

* Verify generated files follow `prompt-builder.instructions.md` standards
* Confirm frontmatter schema is correct for each file type
* Check that cross-references between agent, prompt, and templates are consistent

Report the list of generated files with their paths. Include a summary of the workflow structure: phase count, keywords, templates created. Provide a commit message following `commit-message.instructions.md`.

## Workflow Diagram

```mermaid
flowchart TD
    Start([New Workflow Request]) --> Discover[Discovery Questions]
    Discover --> Wait1{User Answers}
    Wait1 -->|clarify| Clarify{Requirements Complete?}
    Clarify -->|No| MoreQ[Follow-up Questions]
    MoreQ --> Wait1
    Clarify -->|Yes| Wait2{User Review}
    Wait2 -->|generate| Generate[Generate Files]
    Generate --> Done([Workflow Created])
    style Start fill:#ffe6e6,stroke:#333
    style Done fill:#e1f5e1,stroke:#333
```
