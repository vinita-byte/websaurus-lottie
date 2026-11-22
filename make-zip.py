"""Builds exports/websaurus-lotties.zip (everything except the big MOVs). Vercel runs this on every deploy."""
import os, zipfile

OUT = "exports/websaurus-lotties.zip"
DIRS = ["lottie", "exports/dotlottie", "exports/mp4", "exports/gif"]

if os.path.exists(OUT):
    os.remove(OUT)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for d in DIRS:
        for name in sorted(os.listdir(d)):
            z.write(os.path.join(d, name))
print(OUT, os.path.getsize(OUT) // 1024, "KB")
