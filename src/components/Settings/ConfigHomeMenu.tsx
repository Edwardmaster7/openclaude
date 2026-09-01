import { Box, Text } from '../../ink.js';
import { homedir } from 'os';
import { join } from 'path';
import * as React from 'react';
import { readConfigHomePreference, type ConfigHomeMode } from '../../utils/configHome.js';
import {
  planConfigHomeMigration,
  runConfigHomeMigration,
  type MigrationPlan,
  type MigrationResult
} from '../../utils/configHomeMigration.js';
import { resolveClaudeConfigHomeDir, resolveConfigDirEnv } from '../../utils/envUtils.js';
import { getFsImplementation } from '../../utils/fsOperations.js';
import { Select } from '../CustomSelect/index.js';

export type ConfigHomeMenuProps = {
  onComplete: (mode: ConfigHomeMode, migrated: boolean) => void;
  onCancel: () => void;
};

/**
 * Which of the five resolution outcomes selected the active directory. The
 * submenu shows this because "why is it still on .openclaude?" is otherwise
 * unanswerable from the UI.
 *
 * 'existing-openclaude' is distinct from 'preference': it covers every
 * pre-upgrade install, where ~/.openclaude has content but the user never
 * visited /config to make an explicit choice. Labeling that state
 * 'preference' would falsely claim a choice the user never made.
 */
export function describeActiveConfigHome(options?: {
  homeDir?: string;
}): {
  path: string;
  reason:
    | 'env'
    | 'preference'
    | 'legacy-fallback'
    | 'clean-install-default'
    | 'existing-openclaude';
} {
  const homeDir = options?.homeDir ?? homedir();
  const configDirEnv = resolveConfigDirEnv({
    openClaudeConfigDir: process.env.OPENCLAUDE_CONFIG_DIR,
    legacyConfigDir: process.env.CLAUDE_CONFIG_DIR
  });
  if (configDirEnv) {
    return {
      path: resolveClaudeConfigHomeDir({ configDirEnv }),
      reason: 'env'
    };
  }

  const path = resolveClaudeConfigHomeDir({ homeDir });
  if (readConfigHomePreference({ homeDir }) !== undefined) {
    return { path, reason: 'preference' };
  }

  const fs = getFsImplementation();
  const hasOpenClaude = fs.existsSync(join(homeDir, '.openclaude'));
  const hasClaude = fs.existsSync(join(homeDir, '.claude'));
  if (!hasOpenClaude && hasClaude) {
    return { path, reason: 'legacy-fallback' };
  }
  if (!hasOpenClaude && !hasClaude) {
    return { path, reason: 'clean-install-default' };
  }
  // hasOpenClaude is true here (whether or not .claude also exists) and no
  // preference was ever recorded — this is every pre-upgrade install.
  return { path, reason: 'existing-openclaude' };
}

function countSessions(projectsDir: string): { projects: number; sessions: number } {
  const fs = getFsImplementation();
  let projects = 0;
  let sessions = 0;
  try {
    for (const entry of fs.readdirStringSync(projectsDir)) {
      const full = join(projectsDir, entry);
      if (!fs.statSync(full).isDirectory()) continue;
      projects++;
      sessions += fs
        .readdirStringSync(full)
        .filter(name => name.endsWith('.jsonl')).length;
    }
  } catch {
    // Directory absent — zero of both.
  }
  return { projects, sessions };
}

const REASON_LABEL: Record<
  ReturnType<typeof describeActiveConfigHome>['reason'],
  string
> = {
  env: 'set by OPENCLAUDE_CONFIG_DIR / CLAUDE_CONFIG_DIR',
  preference: 'your choice in /config',
  'legacy-fallback': 'only ~/.claude existed when OpenClaude first ran',
  'clean-install-default': 'default for a new install',
  'existing-openclaude': 'your existing ~/.openclaude install'
};

export function ConfigHomeMenu({
  onComplete,
  onCancel
}: ConfigHomeMenuProps): React.ReactNode {
  const home = homedir();
  const active = React.useMemo(() => describeActiveConfigHome(), []);
  const claudeCounts = React.useMemo(
    () => countSessions(join(home, '.claude', 'projects')),
    [home]
  );
  const openClaudeCounts = React.useMemo(
    () => countSessions(join(home, '.openclaude', 'projects')),
    [home]
  );

  const [pendingMode, setPendingMode] = React.useState<ConfigHomeMode | null>(null);
  const [plan, setPlan] = React.useState<MigrationPlan | null>(null);
  const [migrating, setMigrating] = React.useState(false);
  const [migrationErrors, setMigrationErrors] = React.useState<
    MigrationResult['errors'] | null
  >(null);

  const envLocked = active.reason === 'env';

  if (envLocked) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Conversation &amp; config folder</Text>
        <Text>
          Currently {active.path} — {REASON_LABEL[active.reason]}.
        </Text>
        <Text dimColor>
          Unset the environment variable to choose a folder here.
        </Text>
        <Select
          options={[{ label: 'Back', value: 'back' }]}
          onChange={onCancel}
        />
      </Box>
    );
  }

  if (pendingMode && migrationErrors) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Migration finished with errors</Text>
        <Text>
          {migrationErrors.length} file(s) could not be copied (see below).
          The switch to {pendingMode === 'claude' ? '~/.claude' : '~/.openclaude'}{' '}
          still happened.
        </Text>
        {migrationErrors.slice(0, 2).map((error, index) => (
          <Text key={`${error.path}-${index}`} dimColor>
            {error.path}: {error.message}
          </Text>
        ))}
        <Select
          options={[{ label: 'Continue', value: 'continue' }]}
          onChange={() => {
            onComplete(pendingMode, true);
          }}
        />
      </Box>
    );
  }

  if (pendingMode && plan && !migrating) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Migrate to ~/.claude</Text>
        <Text>
          {plan.totalFilesToCopy} file(s) will be copied from {plan.sourceDir}.
          Nothing is deleted or overwritten.
        </Text>
        {plan.collidingSessionIds.length > 0 ? (
          <Text dimColor>
            {plan.collidingSessionIds.length} session(s) already exist at the
            destination and will be left untouched.
          </Text>
        ) : null}
        {plan.conflictingSettingsKeys.length > 0 ? (
          <Text dimColor>
            settings.json: {plan.conflictingSettingsKeys.join(', ')} already set
            at the destination and will be kept; a backup is written first.
          </Text>
        ) : null}
        <Select
          options={[
            { label: 'Copy now and switch', value: 'migrate' },
            { label: 'Switch without copying', value: 'switch' },
            { label: 'Cancel', value: 'cancel' }
          ]}
          onChange={choice => {
            if (choice === 'cancel') {
              onCancel();
              return;
            }
            if (choice === 'switch') {
              onComplete(pendingMode, false);
              return;
            }
            setMigrating(true);
            // Select's onChange returns void; keep the await off the handler
            // signature so this is not a misused promise.
            void runConfigHomeMigration(plan).then(result => {
              if (result.errors.length > 0) {
                setMigrating(false);
                setMigrationErrors(result.errors);
                return;
              }
              onComplete(pendingMode, true);
            });
          }}
        />
      </Box>
    );
  }

  if (migrating) {
    return <Text>Copying…</Text>;
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Conversation &amp; config folder</Text>
      <Text>
        Currently {active.path} — {REASON_LABEL[active.reason]}.
      </Text>
      <Text dimColor>
        ~/.claude: {claudeCounts.projects} project(s), {claudeCounts.sessions}{' '}
        session(s) · ~/.openclaude: {openClaudeCounts.projects} project(s),{' '}
        {openClaudeCounts.sessions} session(s)
      </Text>
      <Select
        options={[
          { label: '~/.claude (shared with Claude Code)', value: 'claude' },
          { label: '~/.openclaude', value: 'openclaude' }
        ]}
        onChange={mode => {
          const next = mode as ConfigHomeMode;
          if (next === 'claude' && openClaudeCounts.sessions > 0) {
            setPendingMode(next);
            setPlan(planConfigHomeMigration());
            return;
          }
          onComplete(next, false);
        }}
      />
      <Text dimColor>Restart OpenClaude to apply.</Text>
    </Box>
  );
}
