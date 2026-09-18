#!/bin/sh
# Rasterises every page in store/build to its exact Play Store pixel size.
#
# --force-device-scale-factor=1 keeps CSS pixels and output pixels identical, so
# the 1080x1920 layout lands as a 1080x1920 file with no rounding.
# --allow-file-access-from-files lets the file:// pages load the device captures.
set -e
ROOT=/c/d/p/brain-rush
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
CUD="C:/Users/ligio/AppData/Local/Temp/claude/c--d-p-brain-rush/fc06f501-c8b9-4640-a16a-57b195d06c0b/scratchpad/cud"

render() { # <page> <out.png> <w> <h>
  "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=1 --allow-file-access-from-files \
    --user-data-dir="$CUD" --screenshot="$2" --window-size="$3,$4" \
    "file:///c:/d/p/brain-rush/store/build/$1" >/dev/null 2>&1
}

mkdir -p "$ROOT/store/play"
render feature.html "C:/d/p/brain-rush/store/play/feature-graphic-1024x500.png" 1024 500
for i in 01 02 03 04 05 06 07 08; do
  render "shot-$i.html" "C:/d/p/brain-rush/store/play/screenshot-$i.png" 1080 1920
done

# Fail loudly if anything came out at the wrong size or over Play's 8MB cap.
for f in "$ROOT"/store/play/*.png; do
  node -e '
    const fs=require("fs"),b=fs.readFileSync(process.argv[1]);
    const w=b.readUInt32BE(16),h=b.readUInt32BE(20),kb=b.length/1024;
    if(b.length>8*1024*1024) throw new Error(process.argv[1]+" exceeds 8MB");
    console.log(process.argv[1].split(/[\\/]/).pop().padEnd(34), (w+"x"+h).padEnd(11), kb.toFixed(0)+"KB");
  ' "$f"
done
