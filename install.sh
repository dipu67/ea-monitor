#!/usr/bin/env bash
# EA Monitor — install on Linux, macOS, and Termux (Android)
# curl -fsSL https://raw.githubusercontent.com/dipu67/ea-monitor/main/install.sh | bash
set -euo pipefail

REPO_URL="https://github.com/dipu67/ea-monitor.git"
INSTALL_DIR="${EA_MONITOR_HOME:-$HOME/ea-monitor}"
NODE_MAJOR_MIN=20
NVM_VERSION="v0.40.3"

if [ -t 1 ]; then
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
  RED=$'\033[31m'
  RESET=$'\033[0m'
else
  BOLD=""; DIM=""; GREEN=""; YELLOW=""; RED=""; RESET=""
fi

info() { printf "%s==>%s %s\n" "$BOLD$GREEN" "$RESET" "$*"; }
warn() { printf "%s==>%s %s\n" "$BOLD$YELLOW" "$RESET" "$*"; }
die() { printf "%serror:%s %s\n" "$BOLD$RED" "$RESET" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

detect_os() {
  if [ -n "${TERMUX_VERSION:-}" ] || [ -n "${TERMUX_PREFIX:-}" ] \
    || { [ -n "${PREFIX:-}" ] && [[ "$PREFIX" == *com.termux* ]]; } \
    || [ -d /data/data/com.termux/files/usr ]; then
    OS=termux
  elif [ "$(uname -s)" = Darwin ]; then
    OS=macos
  else
    OS=linux
  fi
}

pkg_install() {
  case "$OS" in
    termux)
      pkg update -y
      pkg install -y "$@"
      ;;
    macos)
      have brew || die "Homebrew is required on macOS. Install from https://brew.sh then re-run."
      brew install "$@"
      ;;
    linux)
      if have apt-get; then
        if [ "$(id -u)" -eq 0 ]; then
          apt-get update -y
          DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
        elif have sudo; then
          sudo apt-get update -y
          sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
        else
          return 1
        fi
      elif have dnf; then
        if [ "$(id -u)" -eq 0 ]; then dnf install -y "$@"; elif have sudo; then sudo dnf install -y "$@"; else return 1; fi
      elif have pacman; then
        if [ "$(id -u)" -eq 0 ]; then pacman -Sy --noconfirm "$@"; elif have sudo; then sudo pacman -Sy --noconfirm "$@"; else return 1; fi
      elif have apk; then
        if [ "$(id -u)" -eq 0 ]; then apk add --no-cache "$@"; elif have sudo; then sudo apk add --no-cache "$@"; else return 1; fi
      else
        return 1
      fi
      ;;
  esac
}

node_major() {
  have node || return 1
  node -p "process.versions.node.split('.')[0]"
}

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
}

install_nvm_node() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    info "Installing nvm ($NVM_VERSION)"
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
  fi
  load_nvm
  have nvm || die "nvm installed but could not be loaded. Open a new shell and re-run."
  nvm install 22
  nvm use 22
}

ensure_curl() {
  have curl && return 0
  info "Installing curl"
  case "$OS" in
    termux) pkg_install curl git ;;
    macos) pkg_install curl ;;
    linux) pkg_install curl ca-certificates || die "Install curl, then re-run." ;;
  esac
  have curl || die "curl is required"
}

ensure_git() {
  have git && return 0
  info "Installing git"
  case "$OS" in
    termux) pkg_install git ;;
    macos) pkg_install git ;;
    linux) pkg_install git || die "Install git, then re-run." ;;
  esac
  have git || die "git is required"
}

ensure_node() {
  local major=""
  major="$(node_major || true)"
  if [ -n "$major" ] && [ "$major" -ge "$NODE_MAJOR_MIN" ]; then
    info "Node.js $(node -v) already installed"
    return 0
  fi

  info "Installing Node.js (need ${NODE_MAJOR_MIN}+)"
  case "$OS" in
    termux)
      pkg_install nodejs python make clang binutils
      ;;
    macos)
      if have brew; then
        pkg_install node
      else
        install_nvm_node
      fi
      ;;
    linux)
      if pkg_install nodejs npm; then
        :
      else
        warn "No distro node package available; using nvm"
        if ! have curl; then
          die "Install curl and Node.js ${NODE_MAJOR_MIN}+, then re-run."
        fi
        install_nvm_node
      fi
      ;;
  esac

  load_nvm || true
  major="$(node_major || true)"
  if [ -z "$major" ] || [ "$major" -lt "$NODE_MAJOR_MIN" ]; then
    die "Node.js ${NODE_MAJOR_MIN}+ is required. Installed: ${major:-none}"
  fi
  have npm || die "npm is required (comes with Node.js)"
}

ensure_build_tools() {
  [ "$OS" = termux ] || return 0
  info "Installing Termux build tools (better-sqlite3)"
  pkg_install python make clang binutils pkg-config || true
}

resolve_install_dir() {
  local src="${BASH_SOURCE[0]:-}"
  if [ -n "$src" ] && [ -f "$src" ]; then
    local dir
    dir="$(cd "$(dirname "$src")" && pwd)"
    if [ -f "$dir/package.json" ] && grep -q '"name": "ea-monitor"' "$dir/package.json" 2>/dev/null; then
      INSTALL_DIR="$dir"
      return 0
    fi
  fi
  return 1
}

fetch_repo() {
  if resolve_install_dir; then
    info "Using existing repo at $INSTALL_DIR"
    if [ -d "$INSTALL_DIR/.git" ]; then
      git -C "$INSTALL_DIR" pull --ff-only || warn "Could not fast-forward; continuing with local files"
    fi
    return 0
  fi

  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating $INSTALL_DIR"
    git -C "$INSTALL_DIR" pull --ff-only || warn "Could not fast-forward; continuing with local files"
    return 0
  fi

  if [ -e "$INSTALL_DIR" ] && [ ! -d "$INSTALL_DIR/.git" ]; then
    die "$INSTALL_DIR already exists and is not a git repo. Set EA_MONITOR_HOME to another path."
  fi

  info "Cloning $REPO_URL"
  git clone "$REPO_URL" "$INSTALL_DIR"
}

install_js() {
  cd "$INSTALL_DIR"
  info "Installing npm packages"
  npm install

  info "Generating Prisma client and database"
  npx prisma generate
  npx prisma db push
}

install_launcher() {
  local launcher_dir=""
  local launcher=""

  if [ "$OS" = termux ] && [ -n "${PREFIX:-}" ] && [ -d "$PREFIX/bin" ] && [ -w "$PREFIX/bin" ]; then
    launcher_dir="$PREFIX/bin"
  elif [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
    launcher_dir="$HOME/.local/bin"
  elif mkdir -p "$HOME/bin" 2>/dev/null; then
    launcher_dir="$HOME/bin"
  else
    warn "Could not install launcher; run with: cd $INSTALL_DIR && npm start"
    return 0
  fi

  launcher="$launcher_dir/ea-monitor"
  cat > "$launcher" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$INSTALL_DIR"
exec npm start "\$@"
EOF
  chmod +x "$launcher"
  LAUNCHER="$launcher"
}

print_done() {
  printf "\n%sEA Monitor installed%s\n" "$BOLD" "$RESET"
  printf "  %sos:%s %s\n" "$DIM" "$RESET" "$OS"
  printf "  %sdir:%s %s\n" "$DIM" "$RESET" "$INSTALL_DIR"
  printf "  %snode:%s %s\n" "$DIM" "$RESET" "$(node -v)"
  printf "\nStart:\n"
  if [ -n "${LAUNCHER:-}" ]; then
    printf "  %s\n" "$LAUNCHER"
    printf "  or:  cd %s && npm start\n" "$INSTALL_DIR"
  else
    printf "  cd %s && npm start\n" "$INSTALL_DIR"
  fi
  printf "\nOn first run the terminal asks for:\n"
  printf "  TELEGRAM_BOT_TOKEN   from @BotFather\n"
  printf "  ALLOWED_ID           numeric id from @userinfobot\n\n"
}

main() {
  detect_os
  info "Detected $OS ($(uname -s) $(uname -m))"
  ensure_curl
  ensure_git
  ensure_node
  ensure_build_tools
  fetch_repo
  install_js
  install_launcher
  print_done
}

main "$@"
