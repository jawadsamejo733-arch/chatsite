<?php defined('CHATSITE') || exit; ?>
<header class="hero<?= $site['cover'] !== '' ? ' has-cover' : '' ?>"<?= $site['cover'] !== '' ? ' style="background-image:url(\'' . $h($img($site['cover'])) . '\')"' : '' ?>>
  <div class="hero-in">
    <?php if ($site['logo'] !== ''): ?><img class="logo" src="<?= $h($img($site['logo'])) ?>" alt="">
    <?php else: ?><div class="logo ph"><?= $initial($site['title']) ?></div><?php endif; ?>
    <h1><?= $h($site['title']) ?></h1>
    <?php if ($site['tagline'] !== ''): ?><p class="tag"><?= $h($site['tagline']) ?></p><?php endif; ?>
    <button class="btn" data-chat="Hi! I'd like to book an appointment.">Book in chat</button>
  </div>
</header>
<main class="wrap" style="max-width:820px">
  <?php if ($site['about'] !== ''): ?><section class="about card"><p><?= $nl($site['about']) ?></p></section><?php endif; ?>
  <h2 class="sec"><?= $h($meta['items']) ?></h2>
  <?php if (!$site['items']): ?><div class="card empty">Message us to ask about our services and availability.</div><?php endif; ?>
  <?php foreach ($site['items'] as $it): ?>
  <article class="card svc">
    <?php if ($it['image'] !== ''): ?><img src="<?= $h($img($it['image'])) ?>" alt="" loading="lazy"><?php endif; ?>
    <div class="grow">
      <h3><?= $h($it['name']) ?></h3>
      <?php if ($it['description'] !== ''): ?><p><?= $nl($it['description']) ?></p><?php endif; ?>
    </div>
    <div class="side">
      <?php if ($it['price'] !== ''): ?><span class="price"><?= $h($it['price']) ?></span><?php endif; ?>
      <button class="btn small" data-chat="<?= $h(Sites::chatText($template, $it)) ?>">Book</button>
    </div>
  </article>
  <?php endforeach; ?>
</main>
