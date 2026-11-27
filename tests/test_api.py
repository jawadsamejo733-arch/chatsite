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

    def api(self, route, body=None, query=None, method=None, files=None, csrf=True):
        path = "/api.php?r=" + route + ("&" + urllib.parse.urlencode(query) if query else "")
        headers = {"Accept": "application/json"}
        data = None
        if files is not None:
            boundary = uuid.uuid4().hex
            buf = io.BytesIO()
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
