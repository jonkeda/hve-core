---
description: 'Comprehensive coding guidelines and instructions for hve-core'
---

# General Instructions

Items in the Highest Priority Rules section from attached instructions files override any conflicting guidance.

<!-- <highest-priority-rules> -->
## Priority Rules

* Conventions and styling from the codebase take precedence for all changes.
* Instructions files not already attached are read before deciding on edits.
* Breaking changes are acceptable.
* Backward-compatibility layers or legacy support are added only when explicitly requested.
* Tests, scripts, and one-off markdown docs are created or modified only when explicitly requested.

Rules for comments:

* Remain brief and factual, describing behavior, intent, invariants, and edge cases.
* Thought processes, step-by-step reasoning, and narrative comments do not appear in code.
* Comments that contradict current behavior are removed or updated.
* Temporal markers (phase references, dates, task IDs) are removed from code files during any edit.

Rules for fixing errors:

* Proactively fix any problem encountered while working in the codebase, even when unrelated to the original request.
* Root-cause fixes are preferred over symptom-only patches.
* Further investigation of the codebase or through tools is always allowed.
<!-- </highest-priority-rules> -->

<!-- <project-structure> -->
## Project Structure

This repository contains documentation, scripts, and tooling for the HVE (Hyper Velocity Engineering) Core project.

### Directory Organization

The project is organized into these main areas:

* Artifacts (`artifacts/`) - Agents, prompts, instructions, and skills distributed by the extension.
* Documentation (`docs/`) - Getting started guides, templates, RPI workflow documentation, and contribution guidelines.
* Scripts (`scripts/`) - Automation for linting, security validation, extension packaging, and development tools.
* Extension (`extension/`) - VS Code extension source and packaging.
* GitHub Configuration (`.github/`) - Workflows, issue templates, and repository policies.
* Logs (`logs/`) - Output from validation and analysis scripts.

### Scripts Organization

Scripts are organized by function:

* Development Tools (`scripts/dev-tools/`) - PR reference generation utilities.
* Extension (`scripts/extension/`) - Extension packaging and preparation.
* Linting (`scripts/linting/`) - Markdown validation, link checking, frontmatter validation, and PowerShell analysis.
* Security (`scripts/security/`) - Dependency pinning validation and SHA staleness checks.
* Library (`scripts/lib/`) - Shared utilities such as verified downloads.

### Skills Organization

Skills are self-contained packages providing guidance and utilities:

### Documentation Structure

* Getting Started (`docs/getting-started/`) - Installation and first workflow guides with multiple setup methods.
* RPI (`docs/rpi/`) - Task researcher, planner, and implementor workflow documentation.
* Contributing (`docs/contributing/`) - Guidelines for instructions, prompts, agents, and AI artifacts.
* Templates (`docs/templates/`) - Templates for custom agents, instructions, and prompts.

### Copilot Tracking

The `.copilot-tracking/` directory (gitignored) contains AI-assisted workflow artifacts organized by category:

* Task (`.copilot-tracking/Task/`) - Task research, planning, implementation, and review.
* WorkItem (`.copilot-tracking/WorkItem/`) - ADO work item discovery and planning.
* PR (`.copilot-tracking/PR/`) - PR reference generation, handoff, and review tracking.
* BRD (`.copilot-tracking/BRD/`) - Business requirements document session state.
* PRD (`.copilot-tracking/PRD/`) - Product requirements document session state.
* ADR (`.copilot-tracking/ADR/`) - Architecture Decision Record drafts.
* SecurityPlan (`.copilot-tracking/SecurityPlan/`) - Security plan documents.
* Memory (`.copilot-tracking/Memory/`) - Persistent conversation memory files.
* DocOps (`.copilot-tracking/DocOps/`) - Documentation operations session tracking.
* GitHubIssue (`.copilot-tracking/GitHubIssue/`) - GitHub issue search and tracking logs.
* Sandbox (`.copilot-tracking/Sandbox/`) - Prompt testing sandbox environments.
* InstructionAnalysis (`.copilot-tracking/InstructionAnalysis/`) - Instruction file proposal checklists.

All tracking files use markdown format with frontmatter and follow conventions from `artifacts/instructions/copilot-tracking-conventions.instructions.md`.
<!-- </project-structure> -->

<!-- <script-operations> -->
## Script Operations

* Scripts follow instructions provided by the codebase for convention and standards.
* Scripts used by the codebase have an `npm run` script for ease of use.

PowerShell scripts follow PSScriptAnalyzer rules from `PSScriptAnalyzer.psd1` and include proper comment-based help. Validation runs via `npm run lint:ps` with results output to `logs/`.
<!-- </script-operations> -->

<!-- <coding-agent-environment> -->
## Coding Agent Environment

Copilot Coding Agent uses a cloud-based GitHub Actions environment, separate from the local devcontainer. The `.github/workflows/copilot-setup-steps.yml` workflow pre-installs tools to match devcontainer capabilities.

### Pre-installed Tools

* Node.js 20 with npm dependencies from `package.json`
* Python 3.11
* PowerShell 7 with Pester 5.7.1 and PowerShell-Yaml modules
* shellcheck for bash script validation (pre-installed on ubuntu-latest)

### Using npm Scripts

Agents should use npm scripts for all validation:

* `npm run lint:md` - Markdown linting
* `npm run lint:ps` - PowerShell analysis
* `npm run lint:yaml` - YAML validation
* `npm run lint:frontmatter` - Frontmatter validation
* `npm run lint:all` - Run all linters
* `npm run test:ps` - PowerShell tests

### Environment Synchronization

The `copilot-setup-steps.yml` mirrors tools from `.devcontainer/scripts/on-create.sh` and `.devcontainer/scripts/post-create.sh`. When adding tools to the devcontainer, update the setup workflow to maintain parity.
<!-- </coding-agent-environment> -->

🤖 Crafted with precision by ✨Copilot following brilliant human instruction, then carefully refined by our team of discerning human reviewers.
