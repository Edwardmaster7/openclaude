# Design Spec: Bash Security Stress Test

**Author:** OpenClaude
**Date:** 2026-04-28
**Status:** Draft

## Goal
Validate the robustness of the `detectBlockedFileModifications` function against complex, obfuscated, or chained bash commands that attempt to write or modify files via redirection or in-place editing.

## Architecture & Scope
The test suite will be a pure unit test targeting `src/tools/BashTool/bashCommandValidation.ts`. It will use `bun:test` and focus on the AST-based parser's ability to correctly identify blocked patterns regardless of spacing, quoting, or command wrapping.

### Target Patterns (Blocked)
1.  **Redirections:** `>`, `>>`, `&>`, `&>>`, `>|`, `1>`, `2>`.
2.  **Explicit Write Tools:** `cat` (when used as a command), `tee`.
3.  **In-place Editors:** `sed -i`, `sed --in-place`, `perl -i`.
4.  **Interactive Editors:** `vi`, `vim`, `nano`, `ed`.
5.  **Wrapped Redirections:** Redirections following `sudo`, `env`, `time`, `timeout`, etc.

### Safe Patterns (Allowed)
1.  **Redirections to Dev:** `> /dev/null`, `2> /dev/stderr`, `&> /dev/null`.
2.  **File Descriptors:** `2>&1`, `1>&2`.
3.  **Standard Tools:** `ls`, `grep`, `mkdir`, `rm`, `cp`, `mv`, `touch`.
4.  **Complex Reads:** `grep "pattern" file.txt | sort | uniq`.

## Test Matrix

| Category | Example Command | Expected Result |
| :--- | :--- | :--- |
| **Basic Redirection** | `echo "data" > config.json` | **BLOCKED** |
| **No Spaces** | `echo "data">config.json` | **BLOCKED** |
| **Append** | `echo "log" >> system.log` | **BLOCKED** |
| **Stderr to File** | `ls folder 2> error.txt` | **BLOCKED** |
| **Stdout+Stderr** | `build_cmd &> build.log` | **BLOCKED** |
| **Safe Redirection** | `ls /nonexistent 2> /dev/null` | **ALLOWED** |
| **FD Redirection** | `npm install 2>&1` | **ALLOWED** |
| **Blocked Command** | `cat file.txt` | **BLOCKED** |
| **Tee Pipe** | `ls | tee -a registry.txt` | **BLOCKED** |
| **Sed In-place** | `sed -i 's/foo/bar/g' src/index.ts` | **BLOCKED** |
| **Subshell Write** | `(echo "secret" > .env)` | **BLOCKED** |
| **Nested Command** | `sudo bash -c "echo hack > /etc/shadow"` | **BLOCKED** |
| **Ambiguous JSON** | `echo '{"key": "val"}'` | **ALLOWED** |

## Implementation Plan
1.  Update `src/tools/BashTool/bashCommandValidation.test.ts` with the exaustive matrix.
2.  Use `it.each` to iterate through test cases.
3.  Fix any parser failures discovered during testing (e.g., handling of `>&` or complex pipe chains).
