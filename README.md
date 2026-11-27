# ChatSite

Phone-number chat for small businesses and their customers, with a **mini-website for every account**.
When you open a chat with a business that has published a site, a **Website** tab appears next to
**Chat**. The site opens right there, and its "Order in chat" buttons drop a ready-made message into
your composer.

- **Login with a phone number.** A 6-digit SMS code, no passwords. Supports Twilio or any HTTP SMS gateway.
- **Chat is the core**, with the everyday WhatsApp features:
  - one-to-one chats and **groups** (name, photo, description, admins, add/remove people, exit group)
  - **photos** (compressed, with phone-camera location data removed), **videos**, **documents**,
    **voice messages** recorded in the app, and **sharing your location**
  - **reply** to a message, **emoji reactions**, **edit** (15 minutes), **delete** for me or for
    everyone (2 days; group admins can remove any message), **forward** to up to 5 chats, copy
  - sent ✓, delivered ✓✓ and read ticks (in groups: read by everyone), **typing…**, online/last seen
  - **pin** (up to 3), **mute** (8 hours / 1 week / always), **archive**, delete chat, block
  - **search** inside a chat, unread markers, emoji picker, profile photos
  - **notifications** with a sound while the app is open, including in a background tab
- **Mini-sites are the add-on.** Merchants either fill in a template (Online shop, Restaurant menu,
  Services & booking, Profile & links) with photos, prices, hours and links, or use their own code.
  Every site also has a public link (`your-domain/s/<name>/`) to share anywhere.
- **Anyone can make a custom site with AI.** The app gives merchants a ready-made prompt to copy into
  ChatGPT, Claude, Gemini or any AI chat. They paste the AI's answer back and tap **Publish**, and the
  site is live. Extra chat text around the code is removed automatically. Developers can still upload
  a `.zip` with several pages and images.
- **Built for GoDaddy cPanel hosting.** Plain PHP 8.1+ and MySQL, no Node.js, no build step, no
  Composer. Upload, run the installer, done.

## Security model (why uploaded code is safe)

Merchants can upload any JavaScript, so every mini-site page and file is served with
`Content-Security-Policy: sandbox …` (no `allow-same-origin`). The browser runs the site in a
throwaway, unique origin, even when someone opens the link directly. It cannot read the app's
session, messages or storage. It cannot make authenticated API calls (those need a CSRF token it
can't see). It cannot navigate the app away from inside the chat tab. On top of that:

- PHP, `.htaccess`, hidden files and path tricks (`../`) are rejected in uploads. Files are unpacked
  into `storage/`, which the web server never serves or executes directly, and are streamed back
  by `site.php`.
- Login codes are HMAC-hashed and expire after 10 minutes. A code is locked after 5 wrong tries.
  Requests are limited per number and per IP.
- Sessions use HttpOnly + SameSite cookies, and every write needs a CSRF token. The app pages send
  a strict CSP. `app/` and `storage/` are never served.

## Deploy on GoDaddy (about 15 minutes)

You need a **Linux Web Hosting (cPanel)** plan. The drag-and-drop "Websites + Marketing" builder
cannot run PHP apps, and Windows/Plesk hosting won't read `.htaccess`.

1. **Get the files.** Run `python3 scripts/build_zip.py`, or use a `chatsite-upload.zip`
   you were given. It contains everything that belongs in `public_html`.
2. **Upload.** GoDaddy → My Products → Web Hosting → **cPanel Admin** → **File Manager** →
   open `public_html` (or a subfolder such as `public_html/chat`) → **Upload** the zip →
   right-click it → **Extract** → delete the zip. Turn on *Settings → Show Hidden Files* to see
   `.htaccess` and `.user.ini`.
3. **PHP version.** cPanel → **Select PHP Version** (or *MultiPHP Manager*) → choose **8.1, 8.2 or
   8.3**. Make sure the extensions `pdo_mysql`, `zip`, `curl`, `fileinfo` and `mbstring` are ticked.
4. **Database.** cPanel → **MySQL® Databases**. Create a database, create a user with a strong
   password, then *Add User To Database* with **ALL PRIVILEGES**. Note the full names (they start
   with your cPanel username, e.g. `abc123_chat`).
5. **SMS.** Create a [Twilio](https://www.twilio.com) account. Note the Account SID and Auth Token
   and buy a number, or create a Messaging Service (better for sending abroad). SMS costs money per
   message, and some countries require sender registration before messages arrive reliably, so check
   with your provider for the countries you serve. Any other gateway with an HTTP API also works
   (see `app/config.sample.php`).
6. **Install.** Visit `https://your-domain/install.php` (or `/chat/install.php`). It checks the server,
   creates the tables and writes `app/config.php`. Then **delete `install.php`**.
7. **HTTPS.** Make sure SSL is active for your domain (cPanel → *SSL/TLS Status*). Then edit
   `.htaccess` and remove the `#` in front of the two "Redirect everything to HTTPS" lines.
8. **Try it.** Sign in with your phone, set up your profile, tap the 🏪 icon to build your mini-site,
   publish it, and message yourself from a second phone.

People can also add the app to their phone's home screen; it ships a web-app manifest.

### Settings you may want to change later (`app/config.php`)

| Setting | What it does |
|---|---|
| `app_name` | Name shown in the app, SMS and site footers |
| `default_country_code` | Used when someone types a local number without `+` |
| `sms` | Switch between `twilio`, `http` (any gateway) or `log` (testing only) |
| `test_numbers` | Fixed codes for demo or reviewer accounts, no SMS sent |
| `limits` | Message length, upload sizes, rate limits |

Upload limits also depend on PHP. `.user.ini` raises them to 16 MB, and cPanel's *MultiPHP INI
Editor* can go higher.

### Running it day to day

- **Back up** with cPanel → *Backup*: the database plus `storage/` (uploaded sites and images).
- **Take down an abusive site:** phpMyAdmin → `sites` table → set `published` to `0`
  (`UPDATE sites SET published = 0 WHERE slug = 'the-name';`).
- **Logs** are in `storage/logs/` (`error.log`, `php-error.log`). You can read them in File Manager;
  they are not reachable from the web.

### What's built and what comes next

| Phase | Features | Status |
|---|---|---|
| 1 | Groups, photos, videos, documents, voice messages, location, replies, reactions, edit, delete for everyone, forward, typing, profile photos, pin/mute/archive, search, in-app notifications | **Done** |
| 2 | Notifications when the app is fully closed (Web Push), status/stories, disappearing messages, starred messages, link previews, "read by" info in groups, business tools (quick replies, greeting/away messages, labels) | Planned |
| 3 | Voice and video calls (needs a calling service), instant delivery without polling (needs a real-time server or VPS), end-to-end encryption | Needs more than shared hosting |

Notes:

- Messages arrive within about 2.5 seconds (the app checks for new ones while it's open).
- Voice messages are recorded in the browser's own format. iPhones record AAC, which every browser
  plays. Android and desktop Chrome record WebM/Opus, which older iPhones may not
  play. Converting audio would need a server tool such as ffmpeg, which shared hosting doesn't offer.
- Photo features use the PHP **GD** and **EXIF** extensions. The installer checks for them.

### Before a public launch

These are business tasks the code can't do for you:

- Publish **Terms of Service** and a **Privacy Policy** that cover phone numbers, messages and
  user-uploaded sites, and give people a way to report abuse.
- Messages are protected in transit by HTTPS and stored on your server. They are **not end-to-end
  encrypted**, so say so in your privacy policy.
- Chat updates by polling every 2.5 seconds, which is fine on shared hosting for a growing community.
  When you have many hundreds of people online at once, move to a VPS. The same code runs there
  unchanged.

## Developing

```bash
# Run locally (SQLite, login codes shown on screen, no SMS)
php -S localhost:8080 -t public_html dev/router.php

# Tests: starts its own server; covers login, chat, receipts, blocking, sites, uploads and attacks
python3 -m unittest discover -s tests -v

# Same tests against a real Apache + MySQL install in development mode
CHATSITE_TEST_URL=http://localhost/chat python3 -m unittest discover -s tests

# Build the GoDaddy upload zip
python3 scripts/build_zip.py
```

Structure:

```
chatsite/
  public_html/            ← everything that goes on the server
    index.php             app shell (single-page app)
    api.php               JSON API  (api.php?r=chats, …)
    site.php              serves mini-sites at /s/<name>/ with the sandbox header
    install.php           one-time installer
    assets/               app.js, app.css, icons (no build step)
    app/                  PHP code, templates, schema (blocked from the web)
    storage/              uploads, sessions, logs (blocked from the web)
  dev/router.php          makes `php -S` behave like the .htaccess rules
  tests/test_api.py       end-to-end tests (Python standard library only)
  scripts/build_zip.py    builds dist/chatsite-upload.zip
```

### Custom-code sites: notes for merchants' developers

- The simplest way: paste a single HTML file (all CSS and JS inside it) and tap **Publish**.
- For several pages or your own images, upload a `.zip` and put `index.html` at the top. Sub-pages,
  CSS, JS, images, fonts, audio, video and PDFs are fine. Server code is not.
- Use relative links (`css/style.css`, not `/css/style.css`).
- Sites run sandboxed. `localStorage`, `sessionStorage` and cookies are replaced with in-memory
  versions, so code that uses them keeps working, but nothing is kept after the page closes.
- To let visitors message the business from any button, call `ChatSite.compose("I'd like to order …")`.
  Inside the app this opens the chat with the text ready to send. On the public link it opens the app
  and starts a chat with the business.
