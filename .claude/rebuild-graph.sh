#!/bin/bash
# Rebuilds graphify-out/graph.json for this repo.
#
# `graphify update src --no-cluster` in one shot reliably hangs on this repo
# (see .claude/memory/team/harness-setup-decisions.md) — it's a parser bug on
# specific files, not a scale issue. Workaround: build one graph per top-level
# src/* directory, then merge. Files known to hang the parser on their own are
# excluded via .graphifyignore; graphify honors that from the repo root
# regardless of which subpath is passed to `update`.
set -u
cd "$(git rev-parse --show-toplevel)"

GRAPHS_LIST=$(mktemp)
trap 'rm -f "$GRAPHS_LIST"' EXIT

for d in src/*/; do
  d="${d%/}"
  name=$(basename "$d")
  [ "$name" = "graphify-out" ] && continue
  n=$(find "$d" -name "*.ts" -o -name "*.tsx" | wc -l)
  [ "$n" -eq 0 ] && continue
  echo "building: $d ($n files)"
  rm -rf "$d/graphify-out"
  if graphify update "$d" --no-cluster --force > /tmp/rebuild-graph-unit.log 2>&1; then
    if [ -f "$d/graphify-out/graph.json" ]; then
      echo "$d/graphify-out/graph.json" >> "$GRAPHS_LIST"
    else
      echo "  WARNING: no graph.json produced for $d" >&2
    fi
  else
    echo "  WARNING: graphify failed on $d — see /tmp/rebuild-graph-unit.log" >&2
    tail -20 /tmp/rebuild-graph-unit.log >&2
  fi
done

# root-level loose files (src/*.ts directly, not in any subdir)
ROOTLOOSE=$(mktemp -d)
find src -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) -exec cp {} "$ROOTLOOSE/" \;
if [ -n "$(ls -A "$ROOTLOOSE" 2>/dev/null)" ]; then
  echo "building: src (root-level loose files)"
  if graphify update "$ROOTLOOSE" --no-cluster --force > /tmp/rebuild-graph-unit.log 2>&1; then
    [ -f "$ROOTLOOSE/graphify-out/graph.json" ] && echo "$ROOTLOOSE/graphify-out/graph.json" >> "$GRAPHS_LIST"
  fi
fi

n_graphs=$(wc -l < "$GRAPHS_LIST")
if [ "$n_graphs" -lt 1 ]; then
  echo "No graphs produced — aborting merge." >&2
  exit 1
fi

echo "merging $n_graphs subgraphs into graphify-out/graph.json"
graphs=()
while IFS= read -r line; do
  graphs+=("$line")
done < "$GRAPHS_LIST"
graphify merge-graphs "${graphs[@]}" --out graphify-out/graph.json

# clean up per-directory graphify-out/ leftovers (only the root one is kept)
find src -type d -name graphify-out -exec rm -rf {} + 2>/dev/null
rm -rf "$ROOTLOOSE"

echo "Done: graphify-out/graph.json"
