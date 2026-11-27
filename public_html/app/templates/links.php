<?php defined('CHATSITE') || exit; ?>
<main class="profile">
  <?php if ($site['logo'] !== ''): ?><img class="logo" src="<?= $h($img($site['logo'])) ?>" alt="">
  <?php else: ?><div class="logo ph"><?= $initial($site['title']) ?></div><?php endif; ?>
  <h1><?= $h($site['title']) ?></h1>
  <?php if ($site['tagline'] !== ''): ?><p class="tag"><?= $h($site['tagline']) ?></p><?php endif; ?>
  <?php if ($site['about'] !== ''): ?><p class="about-text"><?= $nl($site['about']) ?></p><?php endif; ?>
  <button class="btn" data-chat="<?= $h($chatHello) ?>">Message me</button>
  <?php if ($site['links']): ?>
  <nav class="linklist">
    <?php foreach ($site['links'] as $ln): ?><a href="<?= $h($ln['url']) ?>" target="_blank" rel="noopener nofollow"><?= $h($ln['label']) ?></a><?php endforeach; ?>
  </nav>
  <?php endif; ?>
  <?php if ($site['items']): ?>
  <div class="mini">
    <?php foreach ($site['items'] as $it): ?>
    <div class="card">
      <div class="grow"><strong><?= $h($it['name']) ?></strong><?php if ($it['description'] !== ''): ?><p><?= $h($it['description']) ?></p><?php endif; ?></div>
      <?php if ($it['price'] !== ''): ?><span class="price"><?= $h($it['price']) ?></span><?php endif; ?>
      <button class="btn small ghost" data-chat="<?= $h(Sites::chatText($template, $it)) ?>">Ask</button>
    </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</main>
