---
description: "Build architecture diagrams from codebase analysis - Brought to you by microsoft/hve-core"
agent: 'arch-diagram-builder'
maturity: stable
---

# Architecture Diagram

Invoke the arch-diagram-builder agent to build high quality architecture diagrams from codebase analysis.

## Inputs

* ${input:topic}: (Required) System or component to diagram.
* ${input:style:ascii}: (Optional, defaults to ascii) Diagram style:
  * ascii - ASCII-art diagram
  * mermaid - Mermaid diagram syntax
* ${input:scope}: (Optional) Scope constraint (e.g., single service, full system, data flow).

---

Invoke arch-diagram-builder mode and proceed with the user's request.
