---
description: "Comprehensive Pull Request review for code quality, security, and convention compliance - Brought to you by microsoft/hve-core"
agent: 'pr-review'
maturity: stable
---

# PR Review

Invoke the pr-review agent for comprehensive Pull Request review ensuring code quality, security, and convention compliance.

## Inputs

* ${input:scope}: (Optional) Review scope focus:
  * full - Complete review across all dimensions
  * security - Focus on security vulnerabilities and practices
  * conventions - Focus on codebase convention compliance
  * tests - Focus on test coverage and quality
* ${input:branch}: (Optional) Source branch to review. Defaults to current branch.

---

Invoke pr-review mode and proceed with the user's request.
