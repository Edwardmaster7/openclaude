import { mkdir, writeFile } from "fs/promises";
import * as React from "react";
import type { CommandResultDisplay } from "../../commands.js";
import { Dialog } from "../../components/design-system/Dialog.js";
import { MemoryFileSelector } from "../../components/memory/MemoryFileSelector.js";
import { getRelativeMemoryPath } from "../../components/memory/MemoryUpdateNotification.js";
import { Box, Link, Text } from "../../ink.js";
import { join } from "path";
import { getProjectRoot } from "../../bootstrap/state.js";
import {
  auditMemoryIntegrity,
  explainMemoryNode,
  exportMemoryGraphJson,
  findMemoryPath,
  forgetMemoryFile,
  formatAuditReport,
  purgeExpiredAndBrokenMemories,
  queryMemoryGraph,
  renderMemoryGraph,
  renderMemoryGraphMermaid,
  renderMemoryTTLDashboard,
  syncTeamMemories,
} from "../../memdir/memoryGraphCli.js";
import { getAutoMemPath } from "../../memdir/paths.js";
import type { LocalJSXCommandCall } from "../../types/command.js";
import { clearMemoryFileCaches, getMemoryFiles } from "../../utils/claudemd.js";
import { getClaudeConfigHomeDir } from "../../utils/envUtils.js";
import { getErrnoCode } from "../../utils/errors.js";
import { logError } from "../../utils/log.js";
import { editFileInEditor } from "../../utils/promptEditor.js";
function MemoryCommand({
  onDone,
}: {
  onDone: (
    result?: string,
    options?: {
      display?: CommandResultDisplay;
    },
  ) => void;
}): React.ReactNode {
  const handleSelectMemoryFile = async (memoryPath: string) => {
    try {
      // Create claude directory if it doesn't exist (idempotent with recursive)
      if (memoryPath.includes(getClaudeConfigHomeDir())) {
        await mkdir(getClaudeConfigHomeDir(), {
          recursive: true,
        });
      }

      // Create file if it doesn't exist (wx flag fails if file exists,
      // which we catch to preserve existing content)
      try {
        await writeFile(memoryPath, "", {
          encoding: "utf8",
          flag: "wx",
        });
      } catch (e: unknown) {
        if (getErrnoCode(e) !== "EEXIST") {
          throw e;
        }
      }
      await editFileInEditor(memoryPath);

      // Determine which environment variable controls the editor
      let editorSource = "default";
      let editorValue = "";
      if (process.env.VISUAL) {
        editorSource = "$VISUAL";
        editorValue = process.env.VISUAL;
      } else if (process.env.EDITOR) {
        editorSource = "$EDITOR";
        editorValue = process.env.EDITOR;
      }
      const editorInfo =
        editorSource !== "default"
          ? `Using ${editorSource}="${editorValue}".`
          : "";
      const editorHint = editorInfo
        ? `> ${editorInfo} To change editor, set $EDITOR or $VISUAL environment variable.`
        : `> To use a different editor, set the $EDITOR or $VISUAL environment variable.`;
      onDone(
        `Opened memory file at ${getRelativeMemoryPath(memoryPath)}\n\n${editorHint}`,
        {
          display: "system",
        },
      );
    } catch (error) {
      logError(error);
      onDone(`Error opening memory file: ${error}`);
    }
  };
  const handleCancel = () => {
    onDone("Cancelled memory editing", {
      display: "system",
    });
  };
  return (
    <Dialog title="Memory" onCancel={handleCancel} color="remember">
      <Box flexDirection="column">
        <React.Suspense fallback={null}>
          <MemoryFileSelector
            onSelect={handleSelectMemoryFile}
            onCancel={handleCancel}
          />
        </React.Suspense>

        <Box marginTop={1}>
          <Text dimColor>
            Learn more: <Link url="https://code.claude.com/docs/en/memory" />
          </Text>
        </Box>
      </Box>
    </Dialog>
  );
}
export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const argStr = typeof args === "string" ? args.trim().toLowerCase() : "";
  const memoryDir = getAutoMemPath();

  if (argStr === "graph --mermaid" || argStr === "graph mermaid") {
    const mermaidText = await renderMemoryGraphMermaid(memoryDir);
    onDone(mermaidText, { display: "system" });
    return null;
  }

  if (argStr === "graph") {
    const graphText = await renderMemoryGraph(memoryDir);
    onDone(graphText, { display: "system" });
    return null;
  }

  if (argStr === "audit") {
    const report = await auditMemoryIntegrity(memoryDir);
    onDone(formatAuditReport(report), { display: "system" });
    return null;
  }

  if (argStr === "ttl" || argStr === "--ttl") {
    const ttlText = await renderMemoryTTLDashboard(memoryDir);
    onDone(ttlText, { display: "system" });
    return null;
  }

  if (argStr === "purge" || argStr === "clean") {
    const res = await purgeExpiredAndBrokenMemories(memoryDir);
    onDone(
      `Auto-healing executed: ${res.totalCleaned} expired memory file(s) removed.`,
      { display: "system" },
    );
    return null;
  }

  if (argStr === "sync" || argStr === "sync pull") {
    const projectRoot = getProjectRoot();
    const projectMemDir = join(projectRoot, ".claude", "memory");
    const res = await syncTeamMemories(memoryDir, projectMemDir, "pull");
    onDone(
      `Team sync complete (Pull -> Local Git): ${res.syncedFiles.length} memory file(s) exported. ${res.ignoredUserMemories.length} 'user' memory file(s) kept private.`,
      { display: "system" },
    );
    return null;
  }

  if (argStr === "sync push") {
    const projectRoot = getProjectRoot();
    const projectMemDir = join(projectRoot, ".claude", "memory");
    const res = await syncTeamMemories(projectMemDir, memoryDir, "push");
    onDone(
      `Team sync complete (Push -> Global AI): ${res.syncedFiles.length} memory file(s) imported. Post-sync auto-healing executed.`,
      { display: "system" },
    );
    return null;
  }

  if (argStr.startsWith("query ")) {
    const q = argStr
      .replace(/^query\s+/, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const res = await queryMemoryGraph(memoryDir, q);
    onDone(res, { display: "system" });
    return null;
  }

  if (argStr.startsWith("path ")) {
    const parts = argStr
      .replace(/^path\s+/, "")
      .trim()
      .split(/\s+/);
    const start = parts[0]?.replace(/^["']|["']$/g, "") ?? "";
    const end = parts[1]?.replace(/^["']|["']$/g, "") ?? "";
    const res = await findMemoryPath(memoryDir, start, end);
    onDone(res, { display: "system" });
    return null;
  }

  if (argStr.startsWith("explain ")) {
    const target = argStr
      .replace(/^explain\s+/, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const res = await explainMemoryNode(memoryDir, target);
    onDone(res, { display: "system" });
    return null;
  }

  if (argStr === "export" || argStr === "graph --export") {
    const jsonStr = await exportMemoryGraphJson(memoryDir);
    onDone(jsonStr, { display: "system" });
    return null;
  }

  if (argStr.startsWith("forget ")) {
    const filename = argStr.replace(/^forget\s+/, "").trim();
    const success = await forgetMemoryFile(memoryDir, filename);
    if (success) {
      onDone(`Memory '${filename}' successfully removed.`, {
        display: "system",
      });
    } else {
      onDone(`Error removing memory '${filename}': file not found.`, {
        display: "system",
      });
    }
    return null;
  }

  // Clear + prime before rendering — Suspense handles the unprimed case,
  // but awaiting here avoids a fallback flash on initial open.
  clearMemoryFileCaches();
  await getMemoryFiles();
  return <MemoryCommand onDone={onDone} />;
};
