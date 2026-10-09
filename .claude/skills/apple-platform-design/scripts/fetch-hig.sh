#!/bin/sh
# Fetch a Human Interface Guidelines page as plain text from Apple's DocC JSON endpoint.
# Usage: scripts/fetch-hig.sh <slug> [<slug> ...]   e.g. buttons  toggles  designing-for-ios
# Slugs are the last path segment of https://developer.apple.com/design/human-interface-guidelines/<slug>
set -e
for slug in "$@"; do
  curl -sS -m 30 -A "Mozilla/5.0" "https://developer.apple.com/tutorials/data/design/human-interface-guidelines/$slug.json" \
  | python3 -c '
import json,sys
d=json.load(sys.stdin);out=[]
def walk(o):
    if isinstance(o,dict):
        t=o.get("type")
        if t=="heading": out.append("\n## "+o.get("text",""))
        elif t=="text" and "text" in o: out.append(o["text"])
        elif t=="codeVoice": out.append("`"+o.get("code","")+"`")
        for k,v in o.items():
            if k in ("references","metadata","hierarchy","schemaVersion","identifier","kind","variants","seeAlsoSections","topicSections"): continue
            if isinstance(v,(dict,list)): walk(v)
        if t in ("paragraph","listItem","tableRow","row"): out.append("\n")
    elif isinstance(o,list):
        for v in o: walk(v)
walk(d.get("primaryContentSections",[]));walk(d.get("sections",[]))
print(" ".join(out).replace(" \n ","\n").replace("\n ","\n"))'
done
