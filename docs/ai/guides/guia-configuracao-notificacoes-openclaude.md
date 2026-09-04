# Guia Multiplataforma: Notificações Clicáveis no OpenClaude e Claude Code

Este guia explica como configurar notificações de desktop no **macOS, Linux e Windows (WSL)** para que, ao clicar na notificação enviada pelo **OpenClaude** ou **Claude Code**, a janela e o projeto exato no terminal/IDE sejam focados com precisão.

---

## 1. Visão Geral dos Hooks de Notificação

Tanto o OpenClaude quanto o Claude Code possuem suporte nativo a **Notification Hooks** no arquivo `settings.json`. O evento `Notification` envia um payload JSON via `stdin` com a mensagem a ser notificada.

Local do arquivo `settings.json`:
- **Global:** `~/.openclaude/settings.json` ou `~/.claude/settings.json`
- **Por Projeto:** `.openclaude/settings.json` ou `.claude/settings.json` (na raiz do repositório)

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.openclaude/notify.sh"
          }
        ]
      }
    ]
  }
}
```

---

## 2. Configuração por Ecossistema

### A. macOS (VS Code, Antigravity, Cursor, Apple Terminal, iTerm2, Ghostty)

#### Dependências
```bash
brew install terminal-notifier
```

#### Script (`~/.openclaude/notify.sh`)
```bash
#!/bin/bash
msg=$(jq -r 'select(.notification_type != "subagent_stop" and .notification_type != "task_completed" and .notification_type != "subagent_completed") | .message' 2>/dev/null)
[ -z "$msg" ] && exit 0

TTY_DEV=$(tty 2>/dev/null)
WORK_DIR="$PWD"

if ! command -v terminal-notifier >/dev/null 2>&1; then
  osascript -e "display notification \"$msg\" with title \"OpenClaude\""
  exit 0
fi

# 1. Antigravity IDE
if pgrep -f "Antigravity IDE" >/dev/null 2>&1; then
  ACTIVATE_APP="com.google.antigravity-ide"
  EXEC_CMD="open -a \"Antigravity IDE\" \"$WORK_DIR\""

# 2. Cursor IDE
elif pgrep -f "Cursor" >/dev/null 2>&1; then
  ACTIVATE_APP="com.todesktop.23031312ki9naea"
  EXEC_CMD="open -a \"Cursor\" \"$WORK_DIR\""

# 3. iTerm2 (Aba/Sessão exata por TTY)
elif [ "$TERM_PROGRAM" = "iTerm.app" ]; then
  terminal-notifier -title "OpenClaude" -message "$msg" -sound default \
    -execute "osascript -e 'tell application \"iTerm2\"
      activate
      repeat with w in windows
        repeat with t in tabs of w
          repeat with s in sessions of t
            if tty of s is \"$TTY_DEV\" then
              select s
              select t
              return
            end if
          end repeat
        end repeat
      end tell'"
  exit 0

# 4. Apple Terminal (Aba/Janela exata por TTY)
elif [ "$TERM_PROGRAM" = "Apple_Terminal" ]; then
  terminal-notifier -title "OpenClaude" -message "$msg" -sound default \
    -execute "osascript -e 'tell application \"Terminal\"
      activate
      repeat with w in windows
        repeat with t in tabs of w
          if tty of t is \"$TTY_DEV\" then
            set selected of t to true
            set index of w to 1
            return
          end if
        end repeat
      end repeat
    end tell'"
  exit 0

# 5. Ghostty
elif [ "$TERM_PROGRAM" = "ghostty" ]; then
  ACTIVATE_APP="com.mitchellh.ghostty"
  EXEC_CMD="open -a \"Ghostty\" \"$WORK_DIR\""

# 6. VS Code Padrão
else
  ACTIVATE_APP="com.microsoft.VSCode"
  EXEC_CMD="open -a \"Visual Studio Code\" \"$WORK_DIR\""
fi

terminal-notifier -title "OpenClaude" -message "$msg" -sound default -activate "$ACTIVATE_APP" -execute "$EXEC_CMD"
```

---

### B. Linux (X11 e Wayland)

#### Dependências
- **X11:** `sudo apt install libnotify-bin xdotool wmctrl`
- **Wayland (Sway/Hyprland):** `sudo apt install libnotify-bin`

#### Script (`~/.openclaude/notify.sh`)
```bash
#!/bin/bash
msg=$(jq -r 'select(.notification_type != "subagent_stop" and .notification_type != "task_completed" and .notification_type != "subagent_completed") | .message' 2>/dev/null)
[ -z "$msg" ] && exit 0

WORK_DIR="$PWD"
PROJECT_NAME=$(basename "$WORK_DIR")

if command -v notify-send >/dev/null 2>&1; then
  notify-send "OpenClaude [$PROJECT_NAME]" "$msg" --icon=terminal

  if [ -n "$DISPLAY" ] && command -v xdotool >/dev/null 2>&1; then
    xdotool search --onlyvisible --name "$PROJECT_NAME" windowactivate 2>/dev/null || \
    xdotool search --onlyvisible --class "code" windowactivate 2>/dev/null
  elif [ -n "$HYPRLAND_INSTANCE_SIGNATURE" ]; then
    hyprctl dispatch focuswindow "class:(code|ghostty|alacritty|kitty)"
  fi
fi
```

---

### C. Windows / WSL (Windows Subsystem for Linux)

#### Script (`~/.openclaude/notify.sh`)
```bash
#!/bin/bash
msg=$(jq -r 'select(.notification_type != "subagent_stop" and .notification_type != "task_completed" and .notification_type != "subagent_completed") | .message' 2>/dev/null)
[ -z "$msg" ] && exit 0

WORK_DIR="$PWD"

if grep -qi microsoft /proc/version 2>/dev/null; then
  powershell.exe -Command "
    [void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
    \$notify = New-Object System.Windows.Forms.NotifyIcon
    \$notify.Icon = [System.Drawing.SystemIcons]::Information
    \$notify.Visible = \$true
    \$notify.ShowBalloonTip(5000, 'OpenClaude', '$msg', [System.Windows.Forms.ToolTipIcon]::Info)
  " 2>/dev/null

  code.exe --reuse-window "$WORK_DIR" 2>/dev/null
fi
```

---

## 3. Ativação e Permissões

Conceda permissão de execução:

```bash
chmod +x ~/.openclaude/notify.sh
```

## 4. Teste de Funcionamento

```bash
echo '{"notification_type":"prompt","message":"Teste de precisão por projeto e terminal!"}' | bash ~/.openclaude/notify.sh
```
