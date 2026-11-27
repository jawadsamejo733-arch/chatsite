<?php
/**
 * Shared page shell for template sites.
 * Available: $site (data), $meta, $template, $owner, $slug, $img(), $h(), $phone, $appUrl, $baseHref
 */
defined('CHATSITE') || exit;

$accent = (string)$site['accent'];
[$r, $g, $b] = sscanf($accent, '#%02x%02x%02x') ?: [79, 70, 229];
$ink = (0.299 * $r + 0.587 * $g + 0.114 * $b) > 160 ? '#14151a' : '#ffffff';
$chatHello = 'Hi! I found you through your website.';
$nl = fn(string $s) => nl2br($h($s), false);
$initial = function (string $s) use ($h) {
    return $h(function_exists('mb_substr') ? mb_strtoupper(mb_substr(trim($s), 0, 1)) : strtoupper(substr(trim($s), 0, 1)));
};
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php if ($baseHref !== null): ?><base href="<?= $h($baseHref) ?>" target="_blank"><?php endif; ?>
<title><?= $h($site['title']) ?></title>
<meta name="description" content="<?= $h($site['tagline']) ?>">
<meta property="og:title" content="<?= $h($site['title']) ?>">
<meta property="og:description" content="<?= $h($site['tagline']) ?>">
<?php if ($site['cover'] !== ''): ?><meta property="og:image" content="<?= $h($img($site['cover'])) ?>"><?php endif; ?>
<style>
:root { --accent: <?= $h($accent) ?>; --ink: <?= $ink ?>; --bg: #f7f7fa; --card: #fff; --text: #17181f; --muted: #636776; --line: #e7e8ee; }
@media (prefers-color-scheme: dark) { :root { --bg: #111217; --card: #1a1c23; --text: #eceef4; --muted: #9da1b0; --line: #2a2d37; } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif; }
img { max-width: 100%; display: block; }
a { color: var(--accent); }
h1, h2, h3 { line-height: 1.2; margin: 0; }
.wrap { max-width: 980px; margin: 0 auto; padding: 0 16px; }
.btn { appearance: none; border: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--accent); color: var(--ink); font: 600 15px/1 inherit; padding: 12px 18px; border-radius: 999px; text-decoration: none; }
.btn:hover { filter: brightness(1.06); }
.btn.ghost { background: transparent; color: var(--accent); box-shadow: inset 0 0 0 1.5px var(--accent); }
.btn.small { padding: 9px 14px; font-size: 14px; }
.btn svg { width: 18px; height: 18px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; }
.sec { font-size: 20px; margin: 32px 0 14px; }
.muted { color: var(--muted); }
.price { font-weight: 700; color: var(--accent); white-space: nowrap; }
.ph { display: grid; place-items: center; background: color-mix(in srgb, var(--accent) 14%, var(--card)); color: var(--accent); font-weight: 700; }
.about { padding: 18px 20px; margin-top: 20px; }
.about p { margin: 0; }
.hero { background: var(--accent); color: var(--ink); position: relative; overflow: hidden; }
.hero.has-cover { background-size: cover; background-position: center; color: #fff; }
.hero.has-cover::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.6)); }
.hero-in { position: relative; padding: 44px 16px 36px; max-width: 980px; margin: 0 auto; }
.hero h1 { font-size: clamp(28px, 6vw, 42px); letter-spacing: -.02em; }
.hero .tag { margin: 8px 0 20px; font-size: 17px; opacity: .92; max-width: 560px; }
.hero .btn { background: #fff; color: #14151a; }
.logo { width: 72px; height: 72px; border-radius: 20px; object-fit: cover; margin-bottom: 16px; box-shadow: 0 6px 24px rgba(0,0,0,.18); background: #fff; }
.logo.ph { font-size: 30px; }
/* shop */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.product { overflow: hidden; display: flex; flex-direction: column; }
.product .pimg { aspect-ratio: 4 / 3; width: 100%; object-fit: cover; }
.product .ph { aspect-ratio: 5 / 2; font-size: 34px; }
.product .pbody { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.product .row { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
.product h3 { font-size: 17px; }
.product p { margin: 0; color: var(--muted); font-size: 14px; flex: 1; }
.product .btn { margin-top: 8px; align-self: flex-start; }
/* menu */
.menu-cat { margin-top: 28px; }
.menu-cat h2 { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
.dish { display: flex; gap: 14px; padding: 14px; align-items: flex-start; }
.dish + .dish { border-top: 1px dashed var(--line); }
.dish img { width: 76px; height: 76px; border-radius: 14px; object-fit: cover; flex: none; }
.dish .grow { flex: 1; min-width: 0; }
.dish .row { display: flex; gap: 12px; align-items: baseline; }
.dish .row h3 { font-size: 16px; }
.dish .row .dots { flex: 1; border-bottom: 2px dotted var(--line); transform: translateY(-4px); }
.dish p { margin: 4px 0 8px; color: var(--muted); font-size: 14px; }
/* services */
.svc { padding: 18px; display: flex; gap: 16px; align-items: center; }
.svc + .svc { margin-top: 12px; }
.svc .grow { flex: 1; min-width: 0; }
.svc h3 { font-size: 17px; }
.svc p { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
.svc .side { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.svc img { width: 64px; height: 64px; border-radius: 14px; object-fit: cover; flex: none; }
/* links */
.t-links body, body.t-links { background: radial-gradient(1200px 500px at 50% -10%, color-mix(in srgb, var(--accent) 28%, var(--bg)), var(--bg)); }
.profile { max-width: 520px; margin: 0 auto; padding: 48px 16px 8px; text-align: center; }
.profile .logo { width: 104px; height: 104px; border-radius: 50%; margin: 0 auto 16px; }
.profile .logo.ph { font-size: 42px; }
.profile h1 { font-size: 28px; }
.profile .tag { color: var(--muted); margin: 6px 0 14px; }
.profile .about-text { margin: 0 0 18px; }
.linklist { display: grid; gap: 12px; margin: 20px 0; }
.linklist a { display: block; padding: 15px 18px; border-radius: 16px; background: var(--card); border: 1px solid var(--line); color: var(--text); text-decoration: none; font-weight: 600; }
.linklist a:hover { border-color: var(--accent); }
.mini { display: grid; gap: 10px; text-align: left; margin-top: 8px; }
.mini .card { padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
.mini .grow { flex: 1; min-width: 0; }
.mini p { margin: 2px 0 0; font-size: 14px; color: var(--muted); }
/* footer */
.info { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin: 32px 0 0; }
.info .card { padding: 16px 18px; }
.info h3 { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.info p { margin: 0; }
.foot { text-align: center; color: var(--muted); font-size: 13px; padding: 28px 16px 96px; }
.fab { position: fixed; right: 16px; bottom: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
.empty { padding: 28px; text-align: center; color: var(--muted); }
</style>
</head>
<body class="t-<?= $h($template) ?>">
<?php include __DIR__ . '/' . $template . '.php'; ?>

<div class="wrap">
  <?php $infoBlocks = array_filter([
      'Opening hours' => $site['hours'],
      'Address' => $site['address'],
  ]); ?>
  <?php if ($infoBlocks || $phone !== '' || ($site['links'] && $template !== 'links')): ?>
  <section class="info">
    <?php foreach ($infoBlocks as $label => $text): ?>
      <div class="card"><h3><?= $h($label) ?></h3><p><?= $nl($text) ?></p>
        <?php if ($label === 'Address'): ?><p style="margin-top:8px"><a href="https://www.google.com/maps/search/?api=1&amp;query=<?= $h(rawurlencode($text)) ?>" target="_blank" rel="noopener">Open in Maps</a></p><?php endif; ?>
      </div>
    <?php endforeach; ?>
    <?php if ($phone !== ''): ?>
      <div class="card"><h3>Phone</h3><p><a href="tel:<?= $h($phone) ?>"><?= $h($phone) ?></a></p></div>
    <?php endif; ?>
    <?php if ($site['links'] && $template !== 'links'): ?>
      <div class="card"><h3>Links</h3>
        <?php foreach ($site['links'] as $ln): ?><p><a href="<?= $h($ln['url']) ?>" target="_blank" rel="noopener nofollow"><?= $h($ln['label']) ?></a></p><?php endforeach; ?>
      </div>
    <?php endif; ?>
  </section>
  <?php endif; ?>
</div>

<footer class="foot">© <?= gmdate('Y') ?> <?= $h($site['title']) ?> · Made with <?= $h(cfg('app_name')) ?></footer>
<button class="btn fab" data-chat="<?= $h($chatHello) ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>Chat with us</button>

<?php if ($baseHref === null): ?>
<script>
(function () {
  var APP = <?= json_encode($appUrl, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES) ?>;
  var SLUG = <?= json_encode($slug, JSON_HEX_TAG | JSON_HEX_AMP) ?>;
  var framed = window.parent !== window;
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-chat]') : null;
    if (!el) return;
    e.preventDefault();
    var text = el.getAttribute('data-chat') || '';
    if (framed) {
      window.parent.postMessage({ type: 'chatsite:compose', text: text }, '*');
    } else {
      window.location.href = APP + '#/to/' + SLUG + '?text=' + encodeURIComponent(text);
    }
  });
})();
</script>
<?php endif; ?>
</body>
</html>
