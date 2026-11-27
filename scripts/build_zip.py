"""Build dist/chatsite-upload.zip: the contents of public_html, ready to upload to GoDaddy.

    python3 scripts/build_zip.py

Leaves out app/config.php and everything in storage/ except its protection files, so a
zip built from a development checkout never ships your database, uploads or secrets.
"""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public_html")
OUT = os.path.join(ROOT, "dist", "chatsite-upload.zip")
KEEP_IN_STORAGE = {"storage/.htaccess", "storage/index.html"}


def wanted(rel):
    if rel == "app/config.php":
        return False
    if rel.startswith("storage/"):
        return rel in KEEP_IN_STORAGE
    return True


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for dirpath, dirnames, filenames in os.walk(SRC):
            dirnames.sort()
            reldir = os.path.relpath(dirpath, SRC).replace(os.sep, "/")
            reldir = "" if reldir == "." else reldir + "/"
            if reldir:
                z.writestr(zipfile.ZipInfo(reldir), "")  # keep empty folders such as storage/
            for name in sorted(filenames):
                rel = reldir + name
                if wanted(rel):
                    z.write(os.path.join(dirpath, name), rel)
                    count += 1
    print(f"Wrote {OUT} ({count} files, {os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
