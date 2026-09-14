#!/bin/sh
set -eu
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

resolve_version() {
  version=$(node scripts/version.mjs next "$2" "$1") || exit 1
  if git rev-parse -q --verify "refs/tags/v$version" >/dev/null; then
    echo "tag v$version already exists" >&2
    exit 1
  fi
  printf '%s\n' "$version"
}

bare_version() {
  printf '%s\n' "$1" | sed 's/^v//'
}
