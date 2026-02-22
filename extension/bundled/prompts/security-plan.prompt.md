---
category: 'Security'
description: "Create comprehensive cloud security plans - Brought to you by microsoft/hve-core"
agent: 'security-plan-creator'
maturity: stable
---

# Security Plan

Invoke the security-plan-creator agent for creating comprehensive cloud security plans.

## Inputs

* ${input:system}: (Required) System or application to create a security plan for.
* ${input:cloudProvider}: (Optional) Target cloud provider:
  * azure - Microsoft Azure
  * aws - Amazon Web Services
  * gcp - Google Cloud Platform
* ${input:template}: (Optional) Path to a security plan template to use as a base.

---

Invoke security-plan-creator mode and proceed with the user's request.
