# Bash Security Stress Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an exhaustive test suite to validate bash command blocking against advanced redirection and obfuscation techniques.

**Architecture:** We will use `bun:test` to create a matrix of test cases targeting `detectBlockedFileModifications` in `src/tools/BashTool/bashCommandValidation.ts`.

**Tech Stack:** TypeScript, Bun Test, Shell-quote (via our existing utils).

---

### Task 1: Comprehensive Redirection & Obfuscation Matrix

**Files:**
- Modify: `src/tools/BashTool/bashCommandValidation.test.ts`

- [ ] **Step 1: Replace existing tests with an exhaustive matrix**

Update `src/tools/BashTool/bashCommandValidation.test.ts` with a comprehensive list of blocked and allowed patterns.

```typescript
import { describe, expect, it } from 'bun:test'
import { detectBlockedFileModifications } from './bashCommandValidation.ts'

describe('detectBlockedFileModifications - Security Stress Test', () => {
  const blockedCases = [
    // Basic Redirections
    'echo "foo" > out.txt',
    'echo "foo" >> out.txt',
    'echo "foo" &> out.txt',
    'echo "foo" &>> out.txt',
    'echo "foo" >| out.txt',
    
    // Obfuscated / No-space Redirections
    'echo "foo">out.txt',
    'echo "foo">>out.txt',
    'echo "foo"1>out.txt',
    'echo "foo"2>error.log',
    'ls folder 2>err',
    
    // Chained & Piped Blocks
    'ls | tee file.txt',
    'ls | tee -a file.txt',
    'grep "secret" .env && echo "hack" > pwned',
    'cat file.txt',
    'tee output.txt < input.txt',
    
    // In-place Modifiers
    "sed -i 's/a/b/g' file.ts",
    "sed --in-place 's/a/b/g' file.ts",
    "perl -i -pe 's/foo/bar/' file.php",
    "sed -Ei 's/x/y/' file.js",
    
    // Wrapper Commands
    'sudo echo "root" > /etc/shadow',
    'env FOO=BAR echo "val" > out',
    'time ls > timing.txt',
    'timeout 5s ./script > timeout.log',
    
    // Subshells & Grouping
    '(echo "inner" > inner.txt)',
    '{ echo "grouped" ; } > grouped.txt',
    
    // Advanced/Exotic
    'ls >(cat > file.txt)',
    'exec 3> file.txt',
    'cat <<EOF > script.sh\ncontent\nEOF'
  ]

  const allowedCases = [
    // Standard Reads/Lists
    'ls -la',
    'grep "TODO" src/**/*.ts',
    'find . -name "*.md"',
    
    // Safe Redirections (to /dev/)
    'ls folder > /dev/null',
    'ls folder 2> /dev/null',
    'ls folder &> /dev/null',
    'command > /dev/stderr',
    'echo "debug" > /dev/stdout',
    
    // File Descriptor Manipulations (Internal)
    'npm install 2>&1',
    './run.sh 1>&2',
    
    // Common Utils (that modify files but are explicitly allowed per user)
    'touch newfile.txt',
    'rm oldfile.txt',
    'mv fileA fileB',
    'cp fileA fileB',
    'mkdir new_dir',
    
    // Complex allowed chains
    'grep "pattern" file.txt | sort | uniq -c',
    'export PATH=$PATH:/usr/local/bin && ls'
  ]

  describe('Blocked Commands', () => {
    it.each(blockedCases)('should BLOCK: %s', (cmd) => {
      expect(detectBlockedFileModifications(cmd)).toBe(true)
    })
  })

  describe('Allowed Commands', () => {
    it.each(allowedCases)('should ALLOW: %s', (cmd) => {
      expect(detectBlockedFileModifications(cmd)).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests and identify failures**

Run: `bun test src/tools/BashTool/bashCommandValidation.test.ts`
Expected: Some cases (like `echo "foo">out.txt` or `2>error.log`) might FAIL if the parser is not robust enough.

- [ ] **Step 3: Fix parser in bashCommandValidation.ts (if needed)**

If any test fails, update `src/tools/BashTool/bashCommandValidation.ts` to handle the specific tokenization issue.

- [ ] **Step 4: Verify all tests pass**

Run: `bun test src/tools/BashTool/bashCommandValidation.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/BashTool/bashCommandValidation.test.ts
git commit -m "test(bash): add exhaustive security stress test matrix"
```

---

### Task 2: Advanced Redirection Logic Fixes

**Files:**
- Modify: `src/tools/BashTool/bashCommandValidation.ts`

- [ ] **Step 1: Improve redirection operator detection**

Ensure `detectBlockedFileModifications` handles cases where operators are adjacent to strings or use different FD numbers.

```typescript
// Example fix logic to be applied if needed in src/tools/BashTool/bashCommandValidation.ts
// ... (Logic to be refined based on Task 1 failures)
```

- [ ] **Step 2: Verify with the stress test**

Run: `bun test src/tools/BashTool/bashCommandValidation.test.ts`
Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tools/BashTool/bashCommandValidation.ts
git commit -m "fix(bash): improve redirection detection for edge cases"
```
