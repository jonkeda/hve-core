---
title: Workflow Output Templates
description: AI output templates referenced by workflow agents for structured phase output
---

## Convention

Templates in this directory guide AI-generated output structure for workflow agents.
Each template uses `{{placeholder}}` markers to indicate where the AI inserts content.

* Templates are not runtime-substituted. They guide the AI's output format.
* Templates are not bundled in the VSIX. They are workspace files referenced by agents.
* Use `{{camelCase}}` placeholder markers consistent with `docs/templates/` convention.
* Templates have YAML frontmatter with `title` and `description` fields.

## Template Naming

`{workflow}-{phase}.md` corresponds to one template per workflow phase that produces structured output.

## Distinction from docs/templates/

| Directory            | Purpose                                                                |
|----------------------|------------------------------------------------------------------------|
| `docs/templates/`    | Documentation templates for human-authored documents (BRD, ADR, RCA).  |
| `.github/templates/` | AI output templates referenced by workflow agents for structured phase. |
