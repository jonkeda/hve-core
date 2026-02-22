---
description: "Analyze PRDs and plan Azure DevOps work item hierarchies - Brought to you by microsoft/hve-core"
agent: 'ado-prd-to-wit'
maturity: stable
---

# ADO PRD to Work Items

Invoke the ado-prd-to-wit agent to analyze a Product Requirements Document and plan Azure DevOps work item hierarchies.

## Inputs

* ${input:prdPath}: (Required) Path to the PRD document to analyze.
* ${input:project}: (Required) Azure DevOps project name.
* ${input:areaPath}: (Optional) Target Area Path for new work items.
* ${input:iterationPath}: (Optional) Target Iteration Path for new work items.

---

Invoke ado-prd-to-wit mode and proceed with the user's request.
