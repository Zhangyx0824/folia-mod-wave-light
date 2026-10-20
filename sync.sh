#!/bin/bash
# Sync the mod source into Folia's mod folder, re-authorise it (the digest
# changes whenever a file changes) and relaunch Folia.
set -euo pipefail

SRC="$HOME/folia-mod-wave-light/wave-light"
DEST="$HOME/Library/Application Support/Folia/mods/wave-light"
NODE=/Users/pomepii/.workbuddy/binaries/node/versions/22.22.2-6/bin/node

"$NODE" --check "$SRC/client.mjs"

# osascript quit can fail with -10004 (automation permission); fall back to a
# plain signal so we never keep running the OLD mod code after a sync.
osascript -e 'tell application "Folia" to quit' 2>/dev/null || true
sleep 2
if pgrep -x Folia >/dev/null 2>&1; then
    pkill -TERM -x Folia 2>/dev/null || true
    sleep 2
fi
if pgrep -x Folia >/dev/null 2>&1; then
    pkill -KILL -x Folia 2>/dev/null || true
    sleep 1
fi

mkdir -p "$DEST"
rsync -a --delete "$SRC/" "$DEST/"

# A crash leaves a start note behind, and the next start then asks "start without
# mods this time?" instead of loading them. Drop it so the mod always loads.
rm -f "$HOME/Library/Application Support/Folia/mod-start-note.json"
rm -f "$HOME/Library/Application Support/Folia/mod-start-note-written-off.json"

"$NODE" - <<'EOF'
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MOD_ID = 'wave-light';
const dir = path.join(process.env.HOME, 'Library/Application Support/Folia/mods', MOD_ID);
const files = [];
(function walk(d, prefix) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const abs = path.join(d, entry.name);
        if (entry.isSymbolicLink()) { files.push({ rel, link: fs.readlinkSync(abs) }); continue; }
        if (entry.isDirectory()) { walk(abs, rel); continue; }
        if (!entry.isFile()) continue;
        files.push({ rel, abs });
    }
})(dir, '');
files.sort((a, b) => a.rel.localeCompare(b.rel));

const h = crypto.createHash('sha256');
for (const f of files) {
    h.update(f.rel, 'utf8');
    h.update('\0');
    h.update(f.link !== undefined ? Buffer.concat([Buffer.from('link:'), Buffer.from(f.link, 'utf8')]) : fs.readFileSync(f.abs));
    h.update('\0');
}
const digest = `sha256:${h.digest('hex')}`;

const conf = path.join(process.env.HOME, 'Library/Application Support/Folia/mod-system.json');
const json = JSON.parse(fs.readFileSync(conf, 'utf8'));
json.mods = json.mods || {};
json.mods.enabled = json.mods.enabled || {};
json.mods.enabled[MOD_ID] = {
    enabled: true,
    digest,
    confirmedAt: new Date().toISOString(),
};
fs.writeFileSync(conf, `${JSON.stringify(json, null, '\t')}\n`);
console.log('synced', files.length, 'files; digest', digest.slice(0, 20) + '…');
EOF

open -a Folia
echo "Folia relaunched"
