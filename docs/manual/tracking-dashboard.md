---
title: Tracking Dashboard
description: User manual for the Tracking Dashboard sidebar and detail panels in HVE Core
author: Microsoft
ms.date: 2026-02-23
ms.topic: reference
keywords:
  - tracking dashboard
  - copilot tracking
  - workflow tracking
  - sidebar panel
  - task management
estimated_reading_time: 8
---

The Tracking Dashboard gives you a live overview of all AI-assisted workflows in your workspace. It reads the `.copilot-tracking/` directory structure, maps each folder to a workflow definition, and presents an interactive tree in the VS Code sidebar. From there you can inspect any instance, see which phase is active, open documents, and resume work in Copilot Chat.

## Opening the Dashboard

Click the **HVE Core** icon in the Activity Bar (left sidebar). The Tracking view appears below the Artifacts and Quick Run panels. It populates automatically when your workspace contains a `.copilot-tracking/` folder.

## Sidebar Tree

The sidebar renders a four-level expandable tree.

### Category

The top level groups instances by workflow type. Each category maps to a bundled workflow definition (for example, Task, PR, ADR). Categories display a codicon, a display name, and a badge showing the number of instances.

### Instance

Each instance corresponds to a numbered subfolder inside a category directory (for example, `.copilot-tracking/Task/01_ExtensionUI`). Folder names follow the pattern `NN_Name`, where `NN` is a two-or-more-digit number and `Name` describes the work.

Instances display:

* A colored status dot indicating lifecycle state
* A label formatted as `NN — Name`
* A phase chip showing the icon and label of the currently active phase

### Phase

Phases represent the stages defined in the workflow file. Each phase shows its codicon, label, and a badge with the document count. The CSS styling reflects the phase state:

* **Complete** (green): all prior phases with documents
* **Active** (highlighted): the furthest-along phase that contains documents
* **Pending** (dimmed): phases after the active one with no documents yet

### Document

The leaf level lists individual markdown files within each phase folder. The display title is extracted from the first `# heading` in the file; if no heading exists, the filename (without `.md`) is used instead.

## Navigating

| Action | Where | Result |
|---|---|---|
| Single-click a document | Sidebar tree | Opens the file in the editor (preview mode) |
| Double-click an instance | Sidebar tree | Opens the Tracking Detail panel |
| Click a document | Detail panel | Opens the file in the editor |
| Click "Open Folder" | Detail panel phase section | Reveals the phase folder in the Explorer sidebar |

## Tracking Detail Panel

Double-clicking an instance in the sidebar (or triggering the `hveCore.openTrackingDetail` command) opens a full-width editor tab with detailed information about that instance.

### Header

Displays the instance title, metadata (category, active phase, total document count), and a lifecycle dropdown.

### Stepper

A horizontal timeline shows every phase as a connected circle. Each circle contains the phase's codicon; below it, the label and document count appear. Circle styling matches the phase state: green-filled for complete, blue-bordered with a glow for active, dimmed for pending.

### Resume Actions

A dropdown and "Resume" button appear when the active phase defines a prompt. Selecting an option and clicking Resume opens Copilot Chat with the prompt pre-filled (without auto-submitting), so you can continue the workflow exactly where you left off.

The dropdown offers up to four kinds of options:

* **Continue**: the prompt for the current active phase
* **Branch**: prompts for alternate sub-phases defined in the workflow
* **Feedback**: prompts for later phases that can send feedback to the active phase
* **Back**: prompts for earlier phases, letting you revisit completed work

### Phase Sections

Collapsible sections for each phase list their documents and provide an "Open Folder" button. The active phase starts expanded; other phases are collapsed. Empty phases display "No documents" in italic.

## Lifecycle States

Every instance has a lifecycle state that controls how it appears in the sidebar. Three states exist by default:

| State | Sidebar Indicator |
|---|---|
| Active | Colored status dot |
| Paused | Dimmed gray dot |
| Archived | Dimmed gray dot |

The state is stored in a `.lifecycle` file at the root of the instance folder:

```yaml
status: active
updated: 2026-02-23
reason: optional note
```

If no `.lifecycle` file exists, the instance defaults to **active**. You can change the lifecycle from the detail panel's dropdown; the file is written immediately and the sidebar updates automatically.

Individual workflows can customize the available lifecycle states. For example, the PR workflow defines only `active` and `archived`.

## Phase State Detection

The dashboard determines phase states automatically based on document presence:

1. It scans phases in order and finds the last phase that contains at least one document.
2. All phases before that one are marked **complete**.
3. That phase becomes the **active** phase.
4. All phases after it are marked **pending** (empty).

If no phase has documents, the first phase is marked active. There is no manual phase override; the state is driven entirely by which folders contain files.

## Supported Workflows

The dashboard ships with twelve built-in workflow definitions.

| Category | Display Name | Typical Use |
|---|---|---|
| Task | RPI Task | Research, plan, implement lifecycle |
| WorkItem | ADO Work Item | Azure DevOps work item tracking |
| PR | Pull Request | PR creation and review |
| BRD | Business Requirements | Business requirements documents |
| PRD | Product Requirements | Product requirements documents |
| ADR | Architecture Decision | Architecture decision records |
| SecurityPlan | Security Plan | Security planning workflows |
| Memory | Conversation Memory | Persistent conversation context |
| DocOps | Documentation Ops | Documentation operations |
| GitHubIssue | GitHub Issue | GitHub issue triage and updates |
| Sandbox | Prompt Sandbox | Prompt testing environments |
| InstructionAnalysis | Instruction Analysis | Instruction file proposals |

Each workflow is defined in a `.workflow.md` file with YAML frontmatter that specifies phases, their folder names, associated agents, and resume prompts.

## Auto-Refresh

The dashboard watches `.copilot-tracking/**` for file system changes. When files are created, modified, or deleted, the affected category re-scans after a 300ms debounce period. Both the sidebar tree and any open detail panels update automatically.

## Creating a Tracking Instance

To create a new tracking instance:

1. Create a folder under `.copilot-tracking/{Category}/` using the naming pattern `NN_Name` (for example, `01_MyFeature`).
2. Create subfolders matching the phase folder names defined in the workflow (for example, `research/`, `plan/`, `changes/`).
3. Add markdown files to the appropriate phase folders.

The dashboard discovers the new instance on the next file system event (or when you click the refresh button).

Most workflows are created automatically by HVE Core agents and prompts (for example, `/task-research` creates the Task tracking structure). Manual creation is available for custom workflows or edge cases.

## Empty State

When no `.copilot-tracking/` folder exists or no instances are found, the sidebar displays: "No tracking instances found. Create a .copilot-tracking folder with task instances to get started."

## File Discovery

Only markdown (`.md`) files are displayed. Other file types within phase folders (such as `.lifecycle` or non-markdown assets) are excluded from the tree and document counts.
