"""End-to-end tests for the ChatSite API and mini-site server (Python standard library only).

Run:   python3 -m unittest discover -s tests -v
By default this starts PHP's built-in server (SQLite, development mode) on a free port.
Set CHATSITE_TEST_URL=http://host/path/ to test an existing install instead, e.g. Apache + MySQL;
that install must be in development mode (sms driver "log") so the API returns login codes.
"""
import http.cookiejar
import io
import json
import os
import random
import shutil
import socket
import struct
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BASE = os.environ.get("CHATSITE_TEST_URL", "").rstrip("/")
_server = None
_storage = None


def setUpModule():
    global BASE, _server, _storage
    if BASE:
        return
    _storage = tempfile.mkdtemp(prefix="chatsite-test-")
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    env = dict(os.environ, CHATSITE_STORAGE=_storage)
    _server = subprocess.Popen(
        ["php", "-S", f"127.0.0.1:{port}", "-t", os.path.join(ROOT, "public_html"), os.path.join(ROOT, "dev", "router.php")],
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    BASE = f"http://127.0.0.1:{port}"
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE + "/api.php?r=auth/me", timeout=1)
            return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError("PHP server did not start")


def tearDownModule():
    if _server:
        _server.terminate()
        _server.wait(5)
    if _storage:
        shutil.rmtree(_storage, ignore_errors=True)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), NoRedirect())
        self.csrf = ""
        self.user = None

    def raw(self, path, data=None, headers=None, method=None):
        req = urllib.request.Request(BASE + path, data=data, headers=headers or {}, method=method)
        try:
            with self.opener.open(req, timeout=15) as r:
                return r.status, dict(r.headers), r.read()
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read()

    def api(self, route, body=None, query=None, method=None, files=None, csrf=True, fields=None):
        path = "/api.php?r=" + route + ("&" + urllib.parse.urlencode(query) if query else "")
        headers = {"Accept": "application/json"}
        data = None
        if files is not None:
            boundary = uuid.uuid4().hex
            buf = io.BytesIO()
            for name, value in (fields or {}).items():
                buf.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode())
            for name, (filename, content, ctype) in files.items():
                buf.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\"\r\n"
                          f"Content-Type: {ctype}\r\n\r\n".encode())
                buf.write(content)
                buf.write(b"\r\n")
            buf.write(f"--{boundary}--\r\n".encode())
            data = buf.getvalue()
            headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
            method = "POST"
        elif body is not None or method == "POST":
            data = json.dumps(body or {}).encode()
            headers["Content-Type"] = "application/json"
            method = "POST"
        if method == "POST" and csrf:
            headers["X-CSRF-Token"] = self.csrf
        status, hdrs, raw = self.raw(path, data, headers, method or "GET")
        try:
            payload = json.loads(raw.decode() or "null")
        except ValueError:
            payload = {"_raw": raw.decode(errors="replace")}
        if isinstance(payload, dict) and payload.get("csrf"):
            self.csrf = payload["csrf"]
        return status, payload

    def login(self, phone, name="Tester", business=""):
        self.api("auth/me")
        st, r = self.api("auth/request-code", {"phone": phone})
        assert st == 200, (st, r)
        st, r = self.api("auth/verify-code", {"phone": r["phone"], "code": r["dev_code"]})
        assert st == 200, (st, r)
        st, r = self.api("profile/update", {"name": name, "business_name": business})
        assert st == 200, (st, r)
        self.user = r["user"]
        return self.user


def server_relative(url_path):
    """Site URLs from the API are absolute paths (they include any install subfolder); make them relative to BASE."""
    prefix = urllib.parse.urlparse(BASE).path.rstrip("/")
    return url_path[len(prefix):] if prefix and url_path.startswith(prefix + "/") else url_path


def rand_phone():
    return "+1555" + "".join(random.choice("0123456789") for _ in range(7))


def png_bytes():
    raw = b"\x00\xff\x00\x00"  # 1x1 red pixel, filter byte + RGB
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def make_zip(files):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, content in files.items():
            z.writestr(name, content)
    return buf.getvalue()


class AuthTests(unittest.TestCase):
    def test_full_login_flow_and_protections(self):
        c = Client()
        st, me = c.api("auth/me")
        self.assertEqual(st, 200)
        self.assertIsNone(me["user"])
        self.assertTrue(me["config"]["templates"])

        st, r = c.api("chats")
        self.assertEqual(st, 401)

        st, r = c.api("auth/request-code", {"phone": "+1555"}, csrf=True)
        self.assertEqual(st, 400)

        st, r = c.api("auth/request-code", {"phone": rand_phone()}, csrf=False)
        self.assertEqual(st, 403, "POST without CSRF token must be rejected")
        self.assertEqual(r.get("code"), "csrf")

        phone = rand_phone()
        st, r = c.api("auth/request-code", {"phone": phone})
        self.assertEqual(st, 200, r)
        self.assertRegex(r["dev_code"], r"^\d{6}$")

        st, again = c.api("auth/request-code", {"phone": phone})
        self.assertEqual(st, 429, "resend must be rate limited")

        wrong = "000000" if r["dev_code"] != "000000" else "111111"
        st, bad = c.api("auth/verify-code", {"phone": phone, "code": wrong})
        self.assertEqual(st, 400)
        self.assertIn("attempt", bad["error"])

        st, ok = c.api("auth/verify-code", {"phone": phone, "code": r["dev_code"]})
        self.assertEqual(st, 200, ok)
        self.assertEqual(ok["user"]["phone"], phone)

        st, reuse = c.api("auth/verify-code", {"phone": phone, "code": r["dev_code"]})
        self.assertEqual(st, 400, "a code works only once")

        st, me = c.api("auth/me")
        self.assertEqual(me["user"]["phone"], phone)
        self.assertEqual(c.api("chats")[0], 200)

        c.api("auth/logout", method="POST")
        st, me = c.api("auth/me")
        self.assertIsNone(me["user"])

    def test_attempt_limit(self):
        c = Client()
        c.api("auth/me")
        phone = rand_phone()
        st, r = c.api("auth/request-code", {"phone": phone})
        wrong = "000000" if r["dev_code"] != "000000" else "111111"
        for _ in range(5):
            c.api("auth/verify-code", {"phone": phone, "code": wrong})
        st, r2 = c.api("auth/verify-code", {"phone": phone, "code": r["dev_code"]})
        self.assertEqual(st, 429, "correct code must be refused after 5 wrong attempts")

    def test_national_number_normalisation(self):
        c = Client()
        c.api("auth/me")
        st, r = c.api("auth/request-code", {"phone": "(555) 0" + "".join(random.choice("0123456789") for _ in range(6))})
        self.assertEqual(st, 200, r)
        self.assertTrue(r["phone"].startswith("+1555"), r["phone"])


class ChatTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a, cls.b = Client(), Client()
        cls.a.login(rand_phone(), "Alice")
        cls.b.login(rand_phone(), "Bob", "Bob's Bakery")

    def test_conversation_receipts_unread_and_polling(self):
        a, b = self.a, self.b
        st, look = a.api("contacts/lookup", query={"phone": b.user["phone"]})
        self.assertEqual(look["user"]["display_name"], "Bob's Bakery")
        st, none = a.api("contacts/lookup", query={"phone": rand_phone()})
        self.assertIsNone(none["user"])

        st, o = a.api("chats/open", {"user_id": b.user["id"]})
        self.assertEqual(st, 200, o)
        cid = o["chat"]["id"]
        self.assertEqual(a.api("chats/open", {"user_id": b.user["id"]})[1]["chat"]["id"], cid, "opening twice reuses the chat")
        self.assertNotIn(cid, [c["id"] for c in b.api("chats")[1]["chats"]], "empty chat is hidden from the other side")

        _, bpoll = b.api("poll", query={"since": 0, "rsince": 0})
        since_b, rs_b = max([m["id"] for m in bpoll["messages"]] + [0]), bpoll["now"]

        st, sent = a.api("messages/send", {"chat": cid, "body": "  Hello <b>Bob</b>  "})
        self.assertEqual(st, 200, sent)
        msg = sent["message"]
        self.assertEqual(msg["body"], "Hello <b>Bob</b>")

        st, empty = a.api("messages/send", {"chat": cid, "body": "   "})
        self.assertEqual(st, 400)

        _, bl = b.api("chats")
        mine = [c for c in bl["chats"] if c["id"] == cid][0]
        self.assertEqual(mine["unread"], 1)
        self.assertEqual(mine["peer"]["display_name"], "Alice")

        _, p = b.api("poll", query={"since": since_b, "rsince": rs_b})
        self.assertIn(msg["id"], [m["id"] for m in p["messages"]])

        _, apoll = a.api("poll", query={"since": msg["id"], "rsince": 0})
        rc = [r for r in apoll["receipts"] if r["chat"] == cid][0]
        self.assertGreaterEqual(rc["peer_delivered_id"], msg["id"], "delivered after the recipient polled")
        self.assertLess(rc["peer_read_id"], msg["id"])

        b.api("chats/read", {"chat": cid, "upto": msg["id"]})
        _, apoll = a.api("poll", query={"since": msg["id"], "rsince": 0})
        rc = [r for r in apoll["receipts"] if r["chat"] == cid][0]
        self.assertGreaterEqual(rc["peer_read_id"], msg["id"], "read receipt")
        self.assertEqual([c for c in b.api("chats")[1]["chats"] if c["id"] == cid][0]["unread"], 0)

        long = "x" * 5000
        _, s2 = b.api("messages/send", {"chat": cid, "body": long})
        self.assertEqual(len(s2["message"]["body"]), 4000)

        _, hist = a.api("messages", query={"chat": cid})
        self.assertEqual([m["id"] for m in hist["messages"]][-2:], [msg["id"], s2["message"]["id"]])

        outsider = Client()
        outsider.login(rand_phone(), "Eve")
        self.assertEqual(outsider.api("messages", query={"chat": cid})[0], 404)
        self.assertEqual(outsider.api("messages/send", {"chat": cid, "body": "hi"})[0], 404)
        _, ep = outsider.api("poll", query={"since": 0, "rsince": 0})
        self.assertNotIn(cid, [m["chat"] for m in ep["messages"]])

    def test_block_and_unblock(self):
        a, b = Client(), Client()
        a.login(rand_phone(), "A")
        b.login(rand_phone(), "B")
        cid = a.api("chats/open", {"user_id": b.user["id"]})[1]["chat"]["id"]
        a.api("messages/send", {"chat": cid, "body": "hi"})
        st, r = b.api("chats/block", {"chat": cid})
        self.assertTrue(r["chat"]["blocked"])
        self.assertEqual(a.api("messages/send", {"chat": cid, "body": "spam"})[0], 403)
        self.assertEqual(b.api("messages/send", {"chat": cid, "body": "x"})[0], 403)
        b.api("chats/unblock", {"chat": cid})
        self.assertEqual(a.api("messages/send", {"chat": cid, "body": "ok now"})[0], 200)

    def test_cannot_chat_with_self(self):
        self.assertEqual(self.a.api("chats/open", {"user_id": self.a.user["id"]})[0], 400)


class SiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.owner, cls.visitor = Client(), Client()
        cls.owner.login(rand_phone(), "Sara", "Sara Cakes " + uuid.uuid4().hex[:6])
        cls.visitor.login(rand_phone(), "Visitor")

    def get(self, path, client=None):
        return (client or Client()).raw(path)

    def test_template_site_lifecycle(self):
        o = self.owner
        st, r = o.api("site")
        self.assertEqual(st, 200)
        site = r["site"]
        self.assertTrue(site["slug"].startswith("sara-cakes"), site["slug"])
        self.assertFalse(site["live"])

        st, hdrs, body = self.get(f"/s/{site['slug']}/")
        self.assertEqual(st, 404, "unpublished site is hidden")

        st, hdrs, body = self.get(f"/s/{site['slug']}")
        self.assertEqual(st, 301)
        self.assertTrue(hdrs["Location"].endswith(f"/s/{site['slug']}/"))

        st, up = o.api("site/image", files={"file": ("p.png", png_bytes(), "image/png")})
        self.assertEqual(st, 200, up)
        self.assertRegex(up["path"], r"^media/[a-f0-9]{24}\.png$")
        st, fake = o.api("site/image", files={"file": ("x.png", b"<?php echo 1; ?>", "image/png")})
        self.assertEqual(st, 400, "non-images are rejected")

        data = {
            "title": "Sara <script>alert(1)</script>", "tagline": "Fresh cakes", "accent": "#c2410c",
            "logo": up["path"], "cover": "../../etc/passwd", "show_phone": True,
            "items": [{"name": "Chocolate cake", "price": "Rs 1,200", "description": "Rich", "image": up["path"]},
                      {"name": "", "price": "skip me"}],
            "links": [{"label": "Insta", "url": "instagram.com/sara"}, {"label": "Bad", "url": "javascript:alert(1)"}],
        }
        st, saved = o.api("site/save", {"slug": site["slug"], "mode": "template", "template": "shop", "published": True, "data": data})
        self.assertEqual(st, 200, saved)
        s = saved["site"]
        self.assertTrue(s["live"])
        self.assertEqual(len(s["data"]["items"]), 1, "items without a name are dropped")
        self.assertEqual(s["data"]["cover"], "", "image paths are validated")
        self.assertEqual(s["data"]["links"], [{"label": "Insta", "url": "https://instagram.com/sara"}])

        st, hdrs, body = self.get(f"/s/{s['slug']}/")
        html = body.decode()
        self.assertEqual(st, 200)
        self.assertIn("sandbox allow-scripts", hdrs["Content-Security-Policy"])
        self.assertNotIn("allow-same-origin", hdrs["Content-Security-Policy"])
        self.assertIn("Sara &lt;script&gt;alert(1)&lt;/script&gt;", html)
        self.assertNotIn("<script>alert(1)", html)
        self.assertIn("Chocolate cake", html)
        self.assertIn("data-chat=\"Hi! I&#039;d like to order: Chocolate cake (Rs 1,200)\"", html)
        self.assertIn(o.user["phone"], html)

        st, hdrs, img = self.get(f"/s/{s['slug']}/{up['path']}")
        self.assertEqual(st, 200)
        self.assertEqual(hdrs["Content-Type"], "image/png")
        self.assertIn("sandbox", hdrs["Content-Security-Policy"])

        self.assertEqual(self.get(f"/s/{s['slug']}/other.html")[0], 404)

        st, pv = o.api("site/preview", {"template": "menu", "data": data})
        self.assertEqual(st, 200)
        self.assertIn("<base href=", pv["html"])

        st, res = self.visitor.api("sites/resolve", query={"slug": s["slug"]})
        self.assertEqual(res["user"]["id"], o.user["id"])
        cid = self.visitor.api("chats/open", {"user_id": o.user["id"]})[1]["chat"]["id"]
        _, ch = self.visitor.api("chats/one", query={"id": cid})
        self.assertEqual(ch["chat"]["peer"]["site"]["slug"], s["slug"], "chat shows the Website tab")

        o.api("site/save", {"published": False, "data": s["data"]})
        self.assertEqual(self.get(f"/s/{s['slug']}/")[0], 404)
        self.assertEqual(self.visitor.api("sites/resolve", query={"slug": s["slug"]})[0], 404)

    def test_slug_rules(self):
        o = Client()
        o.login(rand_phone(), "Slug Tester")
        o.api("site")
        for bad in ["admin", "ab", "Bad Slug", "-x-", "a--b"]:
            st, r = o.api("site/save", {"slug": bad})
            self.assertEqual(st, 422, bad)
        taken = self.owner.api("site")[1]["site"]["slug"]
        st, r = o.api("site/save", {"slug": taken})
        self.assertEqual(st, 422)
        self.assertFalse(o.api("site/check-slug", query={"slug": taken})[1]["ok"])
        new = "slug-" + uuid.uuid4().hex[:8]
        self.assertTrue(o.api("site/check-slug", query={"slug": new})[1]["ok"])
        self.assertEqual(o.api("site/save", {"slug": new})[1]["site"]["slug"], new)

    def test_custom_code_upload(self):
        o = Client()
        o.login(rand_phone(), "Dev", "Dev Shop")
        slug = o.api("site")[1]["site"]["slug"]
        st, r = o.api("site/save", {"mode": "custom", "published": True})
        self.assertEqual(st, 422, "cannot publish custom mode before uploading")

        z = make_zip({
            "mysite/index.html": "<!doctype html><html><head><title>Mine</title></head><body><h1>Custom!</h1></body></html>",
            "mysite/css/style.css": "h1{color:red}",
            "mysite/about/index.html": "<p>About</p>",
            "__MACOSX/._index.html": "junk",
        })
        st, r = o.api("site/upload", files={"file": ("site.zip", z, "application/zip")})
        self.assertEqual(st, 200, r)
        self.assertEqual(r["site"]["custom_files"], 3)
        self.assertIn("preview_url", r["site"])

        self.assertEqual(self.get(f"/s/{slug}/")[0], 404, "not published yet")
        st, hdrs, body = self.get(server_relative(r["site"]["preview_url"]))
        self.assertEqual(st, 200, "preview token works before publishing")

        st, saved = o.api("site/save", {"mode": "custom", "published": True})
        self.assertEqual(st, 200, saved)
        st, hdrs, body = self.get(f"/s/{slug}/")
        self.assertEqual(st, 200)
        self.assertIn("sandbox allow-scripts", hdrs["Content-Security-Policy"])
        self.assertIn(b"window.ChatSite=", body)
        self.assertIn(b"<h1>Custom!</h1>", body)
        st, hdrs, css = self.get(f"/s/{slug}/css/style.css")
        self.assertEqual((st, hdrs["Content-Type"].split(";")[0]), (200, "text/css"))
        self.assertIn("sandbox", hdrs["Content-Security-Policy"])
        self.assertEqual(self.get(f"/s/{slug}/about/")[0], 200)
        st, hdrs, _ = self.get(f"/s/{slug}/about")
        self.assertEqual(st, 301)
        self.assertTrue(hdrs["Location"].endswith(f"/s/{slug}/about/"))
        self.assertEqual(self.get(f"/s/{slug}/missing.html")[0], 404)
        self.assertEqual(self.get(f"/s/{slug}/../../app/config.sample.php")[0] in (400, 403, 404), True)

        single = b"<html><body>Single page</body></html>"
        st, r = o.api("site/upload", files={"file": ("page.html", single, "text/html")})
        self.assertEqual((st, r["site"]["custom_files"]), (200, 1))
        self.assertIn(b"Single page", self.get(f"/s/{slug}/")[2])
        self.assertEqual(self.get(f"/s/{slug}/css/style.css")[0], 404, "old files are replaced")

        for name, files in {
            "php": {"index.html": "x", "shell.php": "<?php system($_GET[1]);"},
            "htaccess": {"index.html": "x", ".htaccess": "SetHandler php"},
            "traversal": {"index.html": "x", "../evil.html": "x"},
            "no index": {"page.html": "x"},
            "phtml": {"index.html": "x", "a.phtml": "x"},
        }.items():
            st, r = o.api("site/upload", files={"file": ("bad.zip", make_zip(files), "application/zip")})
            self.assertEqual(st, 400, f"{name}: {r}")
        st, r = o.api("site/upload", files={"file": ("evil.php", b"<?php", "text/plain")})
        self.assertEqual(st, 400)
        self.assertIn(b"Single page", self.get(f"/s/{slug}/")[2], "failed uploads keep the live site")

        st, r = o.api("site/remove-custom", method="POST")
        self.assertEqual((st, r["site"]["mode"], r["site"]["custom_files"]), (200, "template", 0))

    def test_paste_code_from_ai_goes_live(self):
        o = Client()
        o.login(rand_phone(), "Paster", "Paste Shop " + uuid.uuid4().hex[:6])
        slug = o.api("site")[1]["site"]["slug"]
        ai_reply = (
            "Sure! Here is your website:\n\n```html\n<!DOCTYPE html>\n<html><head><title>AI site</title></head>"
            "<body><h1>Made by AI</h1><button onclick=\"ChatSite.compose('Hi! I\\'d like to order: Tea (Rs 100)')\">Order</button>"
            "<script>localStorage.setItem('cart','1');document.body.dataset.ok=localStorage.getItem('cart');</script>"
            "</body></html>\n```\n\nLet me know if you want changes!"
        )
        st, r = o.api("site/paste", {"code": ai_reply, "publish": True})
        self.assertEqual(st, 200, r)
        self.assertTrue(r["site"]["live"], "pasting publishes immediately")
        self.assertEqual((r["site"]["mode"], r["site"]["custom_files"]), ("custom", 1))

        st, hdrs, body = self.get(f"/s/{slug}/")
        html = body.decode()
        self.assertEqual(st, 200)
        self.assertIn("sandbox allow-scripts", hdrs["Content-Security-Policy"])
        self.assertTrue(html.startswith("<!DOCTYPE html>"), "the AI's chat text around the code is removed")
        self.assertNotIn("Sure! Here is", html)
        self.assertNotIn("```", html)
        self.assertLess(html.index("window.ChatSite="), html.index("<h1>Made by AI"), "helpers load before the page's own code")
        self.assertIn('"localStorage","sessionStorage"', html)

        st, c = o.api("site/code")
        self.assertTrue(c["html"].startswith("<!DOCTYPE html>"))
        self.assertTrue(c["html"].endswith("</html>"))

        st, r = o.api("site/paste", {"code": "just some words, no code"})
        self.assertEqual(st, 400)
        st, r = o.api("site/paste", {"code": "   "})
        self.assertEqual(st, 400)
        st, r = o.api("site/paste", {"code": "<p>" + "x" * (1600 * 1024) + "</p>"})
        self.assertEqual(st, 413)
        self.assertIn("Made by AI", self.get(f"/s/{slug}/")[2].decode(), "rejected pastes keep the live site")

        o.api("site/paste", {"code": "<!doctype html><body><p>No head here</p></body>"})
        html = self.get(f"/s/{slug}/")[2].decode()
        self.assertTrue(html.lower().startswith("<!doctype html><script>"), "doctype stays first so the page isn't in quirks mode")

        o.api("site/paste", {"code": "<p>Just a fragment</p>"})
        html = self.get(f"/s/{slug}/")[2].decode()
        self.assertTrue(html.startswith("<script>") and html.endswith("<p>Just a fragment</p>"))

        zip_site = make_zip({"index.html": "<html><head></head><body>zip</body></html>", "style.css": "body{}"})
        o.api("site/upload", files={"file": ("s.zip", zip_site, "application/zip")})
        self.assertEqual(self.get(f"/s/{slug}/style.css")[0], 200)
        o.api("site/paste", {"code": "<h1>Pasted again</h1>"})
        self.assertEqual(self.get(f"/s/{slug}/style.css")[0], 404, "pasting replaces uploaded files")

        other = Client()
        other.login(rand_phone(), "Draft")
        oslug = other.api("site")[1]["site"]["slug"]
        st, r = other.api("site/paste", {"code": "<h1>draft</h1>", "publish": False})
        self.assertFalse(r["site"]["live"])
        self.assertEqual(self.get(f"/s/{oslug}/")[0], 404)

    def test_internal_folders_not_served(self):
        for path in ["/app/config.sample.php", "/app/schema/mysql.sql", "/storage/", "/app/lib/Auth.php", "/.htaccess", "/.user.ini"]:
            st, hdrs, body = self.get(path)
            self.assertIn(st, (403, 404), path)
            self.assertNotIn(b"<?php", body, path)

    def test_app_shell_headers(self):
        st, hdrs, body = self.get("/")
        self.assertEqual(st, 200)
        self.assertIn("frame-ancestors 'self'", hdrs["Content-Security-Policy"])
        self.assertIn(b"assets/app.js", body)


WEBM_VOICE = (b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\xf2\x81\x04\x42\xf3\x81\x08"
              b"\x42\x82\x84webm\x42\x87\x81\x04\x42\x85\x81\x02" + b"\x00" * 64)


def users(n, prefix="User"):
    out = []
    for i in range(n):
        c = Client()
        c.login(rand_phone(), f"{prefix} {i}")
        out.append(c)
    return out


def chat_of(client, cid):
    return client.api("chats/one", query={"id": cid})[1]["chat"]


def history(client, cid):
    st, r = client.api("messages", query={"chat": cid})
    return r["messages"] if st == 200 else None


class GroupTests(unittest.TestCase):
    def test_group_lifecycle(self):
        a, b, c, d = users(4, "Member")
        st, r = a.api("groups/create", {"title": "Team <b>", "user_ids": [b.user["id"], c.user["id"], 999999]})
        self.assertEqual(st, 200, r)
        g = r["chat"]
        cid = g["id"]
        self.assertEqual((g["type"], g["title"], g["members_count"], g["my_role"]), ("group", "Team <b>", 3, "admin"))
        self.assertEqual(a.api("groups/create", {"title": "", "user_ids": [b.user["id"]]})[0], 422)
        self.assertEqual(a.api("groups/create", {"title": "Alone", "user_ids": []})[0], 422)

        self.assertIn(cid, [x["id"] for x in b.api("chats")[1]["chats"]], "members see the new group right away")
        self.assertEqual(history(a, cid)[0]["text"], "You created group “Team <b>”")
        self.assertEqual(history(b, cid)[0]["text"], "Member 0 created group “Team <b>”")

        first = a.api("messages/send", {"chat": cid, "body": "before D joined"})[1]["message"]
        self.assertEqual(b.api("groups/update", {"chat": cid, "title": "Hijack"})[0], 403, "only admins edit the group")
        st, info = a.api("groups/update", {"chat": cid, "title": "Team", "description": "Our shop crew"})
        self.assertEqual((info["chat"]["title"], info["chat"]["description"]), ("Team", "Our shop crew"))

        st, info = a.api("groups/add", {"chat": cid, "user_ids": [d.user["id"]]})
        self.assertEqual(len(info["members"]), 4)
        self.assertEqual(info["members"][0]["role"], "admin")
        dh = history(d, cid)
        self.assertNotIn(first["id"], [m["id"] for m in dh], "new members don't see older messages")
        self.assertEqual(dh[-1]["text"], "Member 0 added you")

        a.api("groups/admin", {"chat": cid, "user_id": b.user["id"], "admin": True})
        st, info = b.api("groups/remove", {"chat": cid, "user_id": c.user["id"]})
        self.assertEqual(st, 200, info)
        self.assertEqual(len(info["members"]), 3)
        cc = chat_of(c, cid)
        self.assertFalse(cc["active"])
        self.assertEqual(c.api("messages/send", {"chat": cid, "body": "still here?"})[0], 403)
        after = a.api("messages/send", {"chat": cid, "body": "after C left"})[1]["message"]
        self.assertNotIn(after["id"], [m["id"] for m in history(c, cid)], "removed members stop receiving messages")
        _, cp = c.api("poll", query={"since": first["id"], "rsince": 0})
        self.assertNotIn(after["id"], [m["id"] for m in cp["messages"]])
        self.assertEqual(c.api("chats/delete", {"chat": cid})[0], 200, "a group you left can be deleted")

        # read receipts in groups: "read" only when everyone has read
        b.api("chats/read", {"chat": cid, "upto": after["id"]})
        self.assertLess(chat_of(a, cid)["peer_read_id"], after["id"])
        d.api("chats/read", {"chat": cid, "upto": after["id"]})
        self.assertGreaterEqual(chat_of(a, cid)["peer_read_id"], after["id"])

        # when the last admin leaves... b is still admin, so make a the only admin first
        a.api("groups/admin", {"chat": cid, "user_id": b.user["id"], "admin": False})
        st, r = a.api("groups/leave", {"chat": cid})
        self.assertEqual(st, 200)
        self.assertFalse(r["chat"]["active"])
        _, info = b.api("chats/info", query={"id": cid})
        self.assertIn("admin", [m["role"] for m in info["members"]], "someone is promoted when the last admin leaves")
        self.assertEqual(a.api("groups/add", {"chat": cid, "user_ids": [c.user["id"]]})[0], 403)

        outsider = users(1, "Out")[0]
        self.assertEqual(outsider.api("chats/info", query={"id": cid})[0], 404)
        self.assertEqual(outsider.api("messages/send", {"chat": cid, "body": "x"})[0], 404)


class MediaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a, cls.b, cls.c = users(3, "Media")
        cls.cid = cls.a.api("chats/open", {"user_id": cls.b.user["id"]})[1]["chat"]["id"]

    def upload(self, client, cid, filename, content, ctype, kind, **fields):
        return client.api("messages/upload", files={"file": (filename, content, ctype)}, fields={"chat": cid, "kind": kind, **fields})

    def fetch(self, client, url, headers=None):
        return client.raw("/" + url, headers=headers or {})

    def test_photo_voice_file_location(self):
        a, b, c, cid = self.a, self.b, self.c, self.cid
        st, r = self.upload(a, cid, "p.png", png_bytes(), "image/png", "image", caption="Our new cake")
        self.assertEqual(st, 200, r)
        m = r["message"]
        self.assertEqual((m["kind"], m["body"], m["media"]["w"], m["media"]["h"]), ("image", "Our new cake", 1, 1))
        st, hdrs, body = self.fetch(b, m["media"]["url"])
        self.assertEqual((st, hdrs["Content-Type"]), (200, "image/png"))
        self.assertIn("sandbox", hdrs["Content-Security-Policy"])
        self.assertEqual(self.fetch(c, m["media"]["url"])[0], 404, "people outside the chat can't open its files")
        self.assertEqual(self.fetch(Client(), m["media"]["url"])[0], 403)

        st, hdrs, part = self.fetch(b, m["media"]["url"], {"Range": "bytes=0-9"})
        self.assertEqual((st, len(part), hdrs["Content-Range"].startswith("bytes 0-9/")), (206, 10, True), "range requests (Safari audio/video)")

        st, r = self.upload(a, cid, "voice.webm", WEBM_VOICE, "audio/webm", "voice", duration="3.2")
        self.assertEqual(st, 200, r)
        v = r["message"]
        self.assertEqual((v["kind"], v["media"]["dur"]), ("voice", 3.2))
        st, hdrs, _ = self.fetch(b, v["media"]["url"])
        self.assertEqual((st, hdrs["Content-Type"]), (200, "audio/webm"))
        self.assertEqual(self.upload(a, cid, "v.webm", b"not audio", "audio/webm", "voice")[0], 400)

        st, r = self.upload(a, cid, "Price list.txt", b"<script>alert(1)</script>", "text/plain", "file")
        f = r["message"]
        self.assertEqual((f["kind"], f["media"]["name"]), ("file", "Price list.txt"))
        st, hdrs, body = self.fetch(b, f["media"]["url"])
        self.assertEqual(hdrs["Content-Type"], "application/octet-stream", "documents download, never render")
        self.assertIn("attachment", hdrs["Content-Disposition"])
        self.assertIn("Price%20list.txt", hdrs["Content-Disposition"])

        st, r = a.api("messages/location", {"chat": cid, "lat": 31.5204, "lng": 74.3587})
        self.assertEqual((r["message"]["kind"], r["message"]["media"]["lat"]), ("location", 31.5204))
        self.assertEqual(a.api("messages/location", {"chat": cid, "lat": 123, "lng": 0})[0], 400)

        last = chat_of(b, cid)["last"]
        self.assertEqual(last["text"], "📍 Location")

    def test_jpeg_location_data_is_removed(self):
        try:
            from PIL import Image
        except ImportError:
            self.skipTest("Pillow not installed")
        buf = io.BytesIO()
        img = Image.new("RGB", (3000, 1000), (200, 80, 40))
        exif = Image.Exif()
        exif[0x010F] = "SecretCameraMaker"
        img.save(buf, "JPEG", exif=exif.tobytes())
        raw = buf.getvalue()
        self.assertIn(b"SecretCameraMaker", raw)
        st, r = self.upload(self.a, self.cid, "camera.jpg", raw, "image/jpeg", "image")
        m = r["message"]["media"]
        self.assertEqual((m["w"], m["h"]), (2048, 683), "big photos are scaled down")
        self.assertIn("&t=1", m["thumb"])
        body = self.fetch(self.b, m["url"])[2]
        self.assertNotIn(b"SecretCameraMaker", body, "camera metadata (incl. GPS) is stripped")
        self.assertEqual(self.fetch(self.b, m["thumb"])[1]["Content-Type"], "image/jpeg")

    def test_forward_and_delete_for_everyone(self):
        a, b, c = self.a, self.b, self.c
        cid_ac = a.api("chats/open", {"user_id": c.user["id"]})[1]["chat"]["id"]
        img = self.upload(a, self.cid, "p.png", png_bytes(), "image/png", "image")[1]["message"]
        st, r = a.api("messages/forward", {"id": img["id"], "chats": [cid_ac]})
        self.assertEqual((st, r["count"]), (200, 1))
        fwd = history(c, cid_ac)[-1]
        self.assertTrue(fwd["forwarded"])
        self.assertEqual(self.fetch(c, fwd["media"]["url"])[0], 200, "forwarded files open for the new chat")
        self.assertEqual(c.api("messages/forward", {"id": img["id"], "chats": [cid_ac]})[0], 404, "can't forward what you can't see")

        self.assertEqual(b.api("messages/delete", {"id": img["id"], "for": "everyone"})[0], 403, "only the sender")
        self.assertEqual(a.api("messages/delete", {"id": img["id"], "for": "everyone"})[0], 200)
        gone = [m for m in history(b, self.cid) if m["id"] == img["id"]][0]
        self.assertEqual((gone["deleted"], gone["media"], gone["body"]), (True, None, ""))
        self.assertEqual(self.fetch(b, img["media"]["url"])[0], 404)
        self.assertEqual(self.fetch(c, fwd["media"]["url"])[0], 200, "the forwarded copy is not affected")

        solo = self.upload(a, self.cid, "p.png", png_bytes(), "image/png", "image")[1]["message"]
        a.api("messages/delete", {"id": solo["id"], "for": "everyone"})
        self.assertEqual(self.fetch(a, solo["media"]["url"])[0], 404)

    def test_profile_and_group_photos(self):
        a, b = self.a, self.b
        st, r = a.api("profile/photo", files={"file": ("me.png", png_bytes(), "image/png")})
        self.assertEqual(st, 200, r)
        url = r["user"]["avatar"]
        self.assertTrue(url.startswith("media.php?a="))
        st, hdrs, _ = self.fetch(b, url)
        self.assertEqual((st, hdrs["Content-Type"]), (200, "image/jpeg"))
        self.assertEqual(self.fetch(Client(), url)[0], 403)
        self.assertEqual(chat_of(b, self.cid)["avatar"], url, "chat list shows the photo")
        r = a.api("profile/photo", files={"file": ("x.txt", b"hello", "text/plain")})
        self.assertEqual(r[0], 400)
        st, r = a.api("profile/photo", files={}, fields={"remove": "1"})
        self.assertEqual(r["user"]["avatar"], "")
        self.assertEqual(self.fetch(b, url)[0], 404)

        g = a.api("groups/create", {"title": "Pics", "user_ids": [b.user["id"]]})[1]["chat"]
        st, info = a.api("groups/photo", files={"file": ("g.png", png_bytes(), "image/png")}, fields={"chat": g["id"]})
        self.assertTrue(info["chat"]["avatar"])
        self.assertEqual(b.api("groups/photo", files={"file": ("g.png", png_bytes(), "image/png")}, fields={"chat": g["id"]})[0], 403)


class MessageActionTests(unittest.TestCase):
    def test_reply_react_edit_delete(self):
        a, b = users(2, "Act")
        cid = a.api("chats/open", {"user_id": b.user["id"]})[1]["chat"]["id"]
        useq = b.api("chats")[1]["useq"]
        orig = a.api("messages/send", {"chat": cid, "body": "Do you have red roses?"})[1]["message"]

        st, r = b.api("messages/send", {"chat": cid, "body": "Yes, 12 left", "reply_to": orig["id"]})
        self.assertEqual(r["message"]["reply"]["id"], orig["id"])
        self.assertEqual(r["message"]["reply"]["text"], "Do you have red roses?")
        self.assertEqual(r["message"]["reply"]["sender_name"], "Act 0")

        st, r = b.api("messages/react", {"id": orig["id"], "emoji": "👍"})
        self.assertEqual(r["message"]["reactions"], [{"e": "👍", "u": [b.user["id"]]}])
        a.api("messages/react", {"id": orig["id"], "emoji": "❤️"})
        st, r = b.api("messages/react", {"id": orig["id"], "emoji": "❤️"})
        self.assertEqual(r["message"]["reactions"], [{"e": "❤️", "u": [a.user["id"], b.user["id"]]}], "one reaction per person")
        self.assertEqual(b.api("messages/react", {"id": orig["id"], "emoji": "hello"})[0], 422)
        st, r = b.api("messages/react", {"id": orig["id"], "emoji": ""})
        self.assertEqual(r["message"]["reactions"], [{"e": "❤️", "u": [a.user["id"]]}])

        self.assertEqual(b.api("messages/edit", {"id": orig["id"], "body": "hacked"})[0], 403)
        st, r = a.api("messages/edit", {"id": orig["id"], "body": "Do you have red or white roses?"})
        self.assertEqual((r["message"]["edited"], r["message"]["body"]), (True, "Do you have red or white roses?"))

        _, p = b.api("poll", query={"since": 10**9, "rsince": 0, "useq": useq})
        upd = {m["id"]: m for m in p["updates"]}
        self.assertEqual(upd[orig["id"]]["body"], "Do you have red or white roses?", "edits reach open apps")
        self.assertGreater(p["useq"], useq)

        b.api("messages/delete", {"id": orig["id"], "for": "me"})
        self.assertNotIn(orig["id"], [m["id"] for m in history(b, cid)], "deleted for me")
        self.assertIn(orig["id"], [m["id"] for m in history(a, cid)], "...but not for the other person")
        a.api("messages/delete", {"id": orig["id"], "for": "everyone"})
        m = [x for x in history(a, cid) if x["id"] == orig["id"]][0]
        self.assertEqual((m["deleted"], m["body"], m["reactions"]), (True, "", []))
        self.assertEqual(a.api("messages/edit", {"id": orig["id"], "body": "x"})[0], 403)
        self.assertEqual(chat_of(a, cid)["last"]["text"], "Yes, 12 left")

    def test_typing_settings_search_and_delete_chat(self):
        a, b = users(2, "Set")
        cid = a.api("chats/open", {"user_id": b.user["id"]})[1]["chat"]["id"]
        a.api("messages/send", {"chat": cid, "body": "Invoice #42 is 100% paid"})
        b.api("chats/typing", {"chat": cid})
        _, p = a.api("poll", query={"since": 10**9, "rsince": 0})
        self.assertIn({"chat": cid, "user_id": b.user["id"], "name": "Set 1"}, p["typing"])
        self.assertEqual(chat_of(a, cid)["typing"][0]["name"], "Set 1")
        b.api("messages/send", {"chat": cid, "body": "thanks"})
        self.assertEqual(chat_of(a, cid)["typing"], [], "sending stops the typing indicator")

        self.assertEqual(len(a.api("messages/search", query={"chat": cid, "q": "invoice"})[1]["messages"]), 1)
        self.assertEqual(len(a.api("messages/search", query={"chat": cid, "q": "100%"})[1]["messages"]), 1)
        self.assertEqual(len(a.api("messages/search", query={"chat": cid, "q": "0%_"})[1]["messages"]), 0, "% and _ are literal")

        st, r = a.api("chats/settings", {"chat": cid, "pinned": True, "mute": "8h"})
        self.assertEqual((r["chat"]["pinned"], r["chat"]["muted"]), (True, True))
        st, r = a.api("chats/settings", {"chat": cid, "archived": True})
        self.assertEqual((r["chat"]["archived"], r["chat"]["pinned"]), (True, False), "archiving unpins")
        st, r = a.api("chats/settings", {"chat": cid, "archived": False, "mute": "off"})
        self.assertEqual((r["chat"]["archived"], r["chat"]["muted"]), (False, False))
        self.assertEqual(a.api("chats/settings", {"chat": cid, "mute": "forever-ish"})[0], 422)

        others = users(3, "Pin")
        for o in others:
            oc = a.api("chats/open", {"user_id": o.user["id"]})[1]["chat"]["id"]
            a.api("chats/settings", {"chat": oc, "pinned": True})
        self.assertEqual(a.api("chats/settings", {"chat": cid, "pinned": True})[0], 422, "at most 3 pinned chats")

        self.assertEqual(a.api("chats/delete", {"chat": cid})[0], 200)
        self.assertNotIn(cid, [c["id"] for c in a.api("chats")[1]["chats"]])
        new = b.api("messages/send", {"chat": cid, "body": "are you there?"})[1]["message"]
        self.assertIn(cid, [c["id"] for c in a.api("chats")[1]["chats"]], "a new message brings the chat back")
        self.assertEqual([m["id"] for m in history(a, cid)], [new["id"]], "with the old history cleared")


class AccountDeletionTests(unittest.TestCase):
    def test_delete_account(self):
        a, b = Client(), Client()
        a.login(rand_phone(), "Leaving", "Gone Shop")
        b.login(rand_phone(), "Staying")
        cid = b.api("chats/open", {"user_id": a.user["id"]})[1]["chat"]["id"]
        b.api("messages/send", {"chat": cid, "body": "bye"})
        a.api("site")
        self.assertEqual(a.api("profile/delete", {"confirm": "nope"})[0], 422)
        st, r = a.api("profile/delete", {"confirm": "DELETE"})
        self.assertEqual(st, 200)
        self.assertIsNone(a.api("auth/me")[1]["user"])
        _, ch = b.api("chats/one", query={"id": cid})
        self.assertEqual(ch["chat"]["peer"]["display_name"], "Deleted account")
        self.assertEqual(b.api("chats/open", {"user_id": a.user["id"]})[0], 404)
        c = Client()
        c.login(a.user["phone"], "New owner")
        self.assertNotEqual(c.user["id"], a.user["id"], "the number can sign up again as a fresh account")


if __name__ == "__main__":
    unittest.main()
