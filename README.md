# WebSaurus Lotties

Looping Lottie animations of WebSaurus, the W2 mascot (a red dinosaur in nerd glasses, graphite W2 hoodie, yellow highlighter).

| Animation | Length | What it does |
| --- | --- | --- |
| idle | 4s | Breathing, tail sway, glance, blinks, smug brow, highlighter twirl |
| hype | 2s | Wind up, jump, cackle in the air, squash landing |
| talk | 2s | Mouth flaps for voiceover and explainer videos |
| smug | 3s | The hot take: brow wiggle and side eye |
| shocked | 2s | The "wait, what?" jolt and tremble |
| thinking | 3s | The upgrade: looks up, thought dots pop in |
| cackling | 2s | The useful chaos: bobbing laugh |
| avatar | 3s | Smug loop on an ink circle for profile pictures |

## Files

- `lottie/*.json`: Lottie JSON, 512×512, 60fps, transparent
- `exports/dotlottie/`: one `.lottie` per animation, plus `websaurus-all.lottie` with all eight
- `exports/mp4/`: 1080×1080 H.264 on brand cream, looped to 6s or more for social
- `exports/gif/`: 480×480, 30fps, loops forever
- `exports/mov/`: 1080×1080 ProRes 4444 with transparency for video editors (not in git, regenerate with `node export.mjs`)

## Live site

https://websaurus-lottie.vercel.app has every animation playing, with downloads. The Vercel project is connected to this repo, so every push to `main` deploys to production and other branches get preview URLs. Each deploy runs `make-zip.py` to build the download-all zip; `.vercelignore` keeps the scripts and MOVs out.

## Editing

The JSON is generated, so don't edit it by hand. The character art is copied as SVG paths from the V2 character sheet, and every motion lives in `build.mjs`.

```bash
node build.mjs     # regenerate lottie/*.json
node export.mjs    # regenerate exports (needs Google Chrome and ffmpeg)
python3 -m http.server 8986   # preview at http://localhost:8986
```
