---
title: Workflow Generation Guide
description: Reference guide for the structure of generated workflow files
---

## Generated File Structure

The generate phase produces three file types for each workflow: an agent file, one or more prompt files, and output templates. Each file follows a consistent structure outlined below.

## Agent File Structure

### Frontmatter Schema

* **description** — short summary of the agent's purpose
* **maturity** — `draft`, `experimental`, or `stable`
* **handoffs** — list of prompt files the agent delegates to

### Body Sections

* **Title** — agent display name
* **File Locations** — paths to prompts, templates, and tracking directories
* **Keyword Advancement** — continue commands that transition between phases
* **Required Phases** — ordered list of workflow phases
* **Workflow Diagram** — Mermaid state diagram showing phase transitions

## Prompt File Structure

### Prompt Frontmatter

* **description** — short summary of the prompt's purpose
* **agent** — parent agent file reference
* **maturity** — `draft`, `experimental`, or `stable`
* **argument-hint** — example invocation text shown to users

### Prompt Body Sections

* **Title** — prompt display name
* **Inputs** — required and optional inputs for the prompt
* **Required Steps** — ordered instructions the AI follows
* **Activation** — trigger phrases and conditions

## Template File Structure

### Template Frontmatter

* **title** — template display name
* **description** — short summary of the template's purpose

### Template Body Sections

* **Placeholder markers** — `{{placeholder}}` tokens where the AI inserts content
* **Metadata tables** — structured fields for status, dates, and identifiers
* **Content sections** — headings and body text defining output structure

## Naming Conventions

* Agent files: `{workflow}-workflow.agent.md`
* Prompt files: `{workflow}.prompt.md`
* Template files: `{workflow}-{phase}.md`
