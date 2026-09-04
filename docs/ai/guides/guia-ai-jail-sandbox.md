# Guia de Configuração e Uso do ai-jail (Sandbox para Agentes de IA)

> **Objetivo:** Este guia fornece orientações passo a passo e configurações avançadas para isolar agentes de IA (`OpenClaude`, `Gemini CLI`, `Claude Code`, `Codex`) usando o **ai-jail**. O sandbox restringe a visibilidade do agente exclusivamente ao diretório do projeto, protegendo arquivos pessoais, chaves SSH, credenciais da nuvem e dados do sistema operacional contra acessos não autorizados.

---

## 1. Visão Geral e Arquitetura do ai-jail

O `ai-jail` (desenvolvido por Fábio Akita) atua como um wrapper leve e de altíssimo desempenho para isolamento de processos agênticos:

* **macOS:** Utiliza o mecanismo nativo `sandbox-exec` do macOS via linguagens de perfil SBPL (Sandbox Profile Language). Não requer dependências adicionais e possui overhead próximo de zero microsegundos.
* **Linux / WSL2:** Utiliza `bubblewrap` (`bwrap`) para criar unprivileged user namespaces, isolando montagens de arquivos, processos e rede.

---

## 2. Instalação por Sistema Operacional

### macOS

O Homebrew exige confiar explicitamente no tap de terceiros antes da instalação:

```bash
# Adiciona o tap e autoriza a fórmula
brew tap akitaonrails/tap
brew trust --formula akitaonrails/tap/ai-jail
brew install ai-jail
```

*Alternativa via Cargo (Rust):*
```bash
cargo install ai-jail
```

---

### Linux (Ubuntu, Debian, Fedora, Arch)

Requer o utilitário de sandbox `bubblewrap` do sistema operacional:

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y bubblewrap

# Arch Linux
sudo pacman -S bubblewrap

# Fedora / RHEL
sudo dnf install bubblewrap

# Instalação do ai-jail via Cargo
cargo install ai-jail
```

---

### Windows (via WSL2)

O `ai-jail` não roda nativamente no cmd/PowerShell do Windows; a execução deve ocorrer dentro do ambiente **WSL2** (Ubuntu/Debian):

1. Abra o terminal do WSL2.
2. Instale o `bubblewrap` e o `cargo` (ou Rustup):
   ```bash
   sudo apt update && sudo apt install -y bubblewrap cargo
   cargo install ai-jail
   ```
3. Navegue até o repositório Linux no WSL (ex: `/home/usuario/projects/meu-projeto`).

---

## 3. Estrutura do Arquivo de Configuração `.ai-jail`

O `ai-jail` lê automaticamente o arquivo `.ai-jail` localizado na raiz do projeto em formato TOML:

```toml
# ai-jail sandbox configuration
command = ["openclaude"]

# Mapeamentos de Leitura e Escrita (Read-Write)
rw_maps = [
  "~/.openclaude",
  "~/.gemini",
  "~/.claude",
  "~/.cache",
  "~/.local"
]

# Mapeamentos de Somente Leitura (Read-Only)
ro_maps = [
  "~/.gitconfig"
]
```

### Campos Suportados

* `command`: Vetor de strings com o comando padrão a ser executado quando o `ai-jail` for invocado sem argumentos.
* `rw_maps`: Lista de caminhos fora da pasta do projeto nos quais o agente terá permissão total para ler, criar e modificar arquivos.
* `ro_maps`: Lista de caminhos fora da pasta do projeto nos quais o agente poderá apenas ler dados, sendo bloqueado caso tente escrever ou deletar.
* Expansão de Tilde (`~`): O `ai-jail` expande automaticamente `~` para o diretório `/home/usuario` ou `/Users/usuario`.

---

## 4. Configurações Avançadas e Casos de Uso

### 4.1. Preservando a Memória e Contexto dos Agentes

Agentes como `OpenClaude` e `Gemini CLI` mantêm logs de sessão, configurações de projetos e arquivos de memória dentro de diretórios ocultos na home do usuário. Sem esses mapeamentos em `rw_maps`, o agente falhará ao tentar salvar ou ler a memória persistente:

```toml
rw_maps = [
  "~/.openclaude",  # Memória local/team do OpenClaude e histórico de conversas
  "~/.gemini",      # Cache e memória do Gemini CLI (usado no sync-memory.sh)
  "~/.claude"       # Configurações globais e skills do Claude Code
]
```

---

### 4.2. Suporte a Caches de Tooling (Python, UV, Node.js e MCPs)

Para que ferramentas como `uv`, `ruff`, `pytest` ou servidores MCP do Node funcionem perfeitamente dentro do sandbox sem re-baixar pacotes:

```toml
rw_maps = [
  "~/.cache",       # Caches do pip, uv, ruff, pytest, Playwright, etc.
  "~/.local",       # Binários do usuário (ex: ~/.local/bin/uv, graphify)
  "~/.npm",         # Cache de pacotes npm/npx para MCPs
  "~/.nvm"          # Instalação do Node via NVM (se aplicável)
]
```

---

### 4.3. Git e Acesso Seguro a Repositórios Remotos

Por padrão, o `ai-jail` bloqueia acesso ao `~/.ssh/` para evitar que o agente leia chaves privadas. Para permitir operações Git sem expor as chaves para alteração:

#### Opção A: Leitura Segura de Configurações Globais (Recomendado)
Permite que o Git saiba seu `user.name` e `user.email` para assinar commits, sem dar acesso a chaves SSH:

```toml
ro_maps = [
  "~/.gitconfig"
]
```

#### Opção B: Acesso Read-Only a Chaves SSH para Git Push/Pull
Se o agente precisar interagir diretamente com o GitHub/GitLab via SSH:

```toml
ro_maps = [
  "~/.ssh/known_hosts",
  "~/.ssh/id_ed25519.pub",
  "~/.ssh/id_ed25519"      # Apenas leitura: previne que o agente sobrescreva a chave
]
```

---

### 4.4. Acesso ao Docker Daemon e Sockets do Sistema

Se seus testes ou comandos precisarem interagir com o Docker (`make dev`, `docker ps`), o socket do Docker precisa ser mapeado:

```toml
rw_maps = [
  "/var/run/docker.sock",             # Socket do Docker Daemon no Linux/macOS
  "~/.docker"                         # Configurações e contextos do Docker
]
```

---

### 4.5. Variáveis de Ambiente e Injeção do `.env`

O sandbox do `ai-jail` preserva as variáveis de ambiente do shell pai por padrão. Para passar credenciais do `.env` com segurança sem expor no arquivo `.ai-jail`:

```bash
# Carrega as variáveis no shell atual e invoca o jail
source scripts/load-env.sh
ai-jail openclaude
```

---

## 5. Flags de Execução e Debug do ai-jail

| Comando | Descrição |
| :--- | :--- |
| `ai-jail openclaude` | Inicia o OpenClaude com as regras do `.ai-jail` local. |
| `ai-jail gemini-cli` | Inicia o Gemini CLI com as regras do `.ai-jail` local. |
| `ai-jail bash` | Abre um subshell Bash isolado dentro do sandbox para testar quais pastas estão acessíveis. |
| `ai-jail --dry-run openclaude` | Exibe o perfil SBPL (macOS) ou o comando `bwrap` (Linux) sem executar o processo. |
| `ai-jail --verbose openclaude` | Exibe logs detalhados do processo de montagem e execução do sandbox. |
| `ai-jail --rw-map ~/outra-pasta openclaude` | Adiciona um mapeamento de leitura/escrita temporário apenas para a sessão atual. |
| `ai-jail --ro-map /opt/docs openclaude` | Adiciona um mapeamento de somente-leitura temporário para a sessão atual. |
| `ai-jail --clean --init` | Regenera o arquivo `.ai-jail` padrão com as configurações iniciais. |

---

## 6. Sincronização e Governança em Equipe

O arquivo `.ai-jail` deve ser versionado no repositório Git (`git add .ai-jail && git commit`). Isso garante que qualquer desenvolvedor da equipe que clonar o projeto e utilizar o `ai-jail` herdará exatamente o mesmo nível de isolamento e segurança.
