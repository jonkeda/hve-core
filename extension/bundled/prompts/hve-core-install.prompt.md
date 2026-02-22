---
category: 'General'
description: "Decision-driven HVE-Core installation across multiple methods - Brought to you by microsoft/hve-core"
agent: 'hve-core-installer'
maturity: stable
---

# HVE Core Install

Invoke the hve-core-installer agent for decision-driven installation of HVE-Core across local, devcontainer, and Codespaces environments.

## Inputs

* ${input:method}: (Optional) Installation method override:
  * clone - Git clone into existing workspace
  * submodule - Add as git submodule
  * extension - Install VS Code extension
  * devcontainer - Devcontainer feature
  * codespaces - GitHub Codespaces setup
  * manual - Manual file copy

---

Invoke hve-core-installer mode and proceed with the user's request.
