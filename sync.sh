#!/bin/zsh
# 把模组同步进 Folia 的模组目录。
set -e
DEST="$HOME/Library/Application Support/Folia/mods/wave-light"
mkdir -p "$DEST"
rsync -av --delete --exclude '.git*' --exclude '.DS_Store' "$(dirname "$0")/wave-light/" "$DEST/"
echo "已同步到: $DEST （重启 Folia 并在 设置 → 模组 中启用）"
