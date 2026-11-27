<?php defined('CHATSITE') || exit; ?>
<header class="hero<?= $site['cover'] !== '' ? ' has-cover' : '' ?>"<?= $site['cover'] !== '' ? ' style="background-image:url(\'' . $h($img($site['cover'])) . '\')"' : '' ?>>
  <div class="hero-in">
    <?php if ($site['logo'] !== ''): ?><img class="logo" src="<?= $h($img($site['logo'])) ?>" alt=""><?php endif; ?>
    <h1><?= $h($site['title']) ?></h1>
    <?php if ($site['tagline'] !== ''): ?><p class="tag"><?= $h($site['tagline']) ?></p><?php endif; ?>
    <button class="btn" data-chat="<?= $h($chatHello) ?>">Chat with us</button>
  </div>
</header>
<main class="wrap">
  <?php if ($site['about'] !== ''): ?><section class="about card"><p><?= $nl($site['about']) ?></p></section><?php endif; ?>
  <h2 class="sec"><?= $h($meta['items']) ?></h2>
  <?php if (!$site['items']): ?><div class="card empty">New products are coming soon. Message us to ask what's available.</div><?php endif; ?>
  <div class="grid">
    <?php foreach ($site['items'] as $it): ?>
    <article class="card product">
      <?php if ($it['image'] !== ''): ?><img class="pimg" src="<?= $h($img($it['image'])) ?>" alt="<?= $h($it['name']) ?>" loading="lazy">
      <?php else: ?><div class="ph"><?= $initial($it['name']) ?></div><?php endif; ?>
      <div class="pbody">
        <div class="row"><h3><?= $h($it['name']) ?></h3><?php if ($it['price'] !== ''): ?><span class="price"><?= $h($it['price']) ?></span><?php endif; ?></div>
        <?php if ($it['description'] !== ''): ?><p><?= $nl($it['description']) ?></p><?php endif; ?>
        <button class="btn small" data-chat="<?= $h(Sites::chatText($template, $it)) ?>">Order in chat</button>
      </div>
    </article>
    <?php endforeach; ?>
  </div>
</main>
