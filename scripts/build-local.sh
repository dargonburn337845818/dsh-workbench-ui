#!/usr/bin/env bash
# 本地构建：不需要 DSH checkout，依赖从 dsh-skill-vault 的 node_modules 软链而来。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== host tsc ==="
./node_modules/.bin/tsc -p tsconfig.json

echo "=== client tsdown ==="
./node_modules/.bin/tsdown

echo "=== clean tsc client output ==="
rm -rf lib/client

echo "=== done ==="
