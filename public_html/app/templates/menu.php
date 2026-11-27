<?php
defined('CHATSITE') || exit;
$groups = [];
foreach ($site['items'] as $it) {
    $groups[$it['category'] !== '' ? $it['category'] : 'Menu'][] = $it;
}
?>
<header class="hero<?= $site['cover'] !== '' ? ' has-cover' : '' ?>"<?= $site['cover'] !== '' ? ' style="background-image:url(\'' . $h($img($site['cover'])) . '\')"' : '' ?>>
  <div class="hero-in" style="text-align:center">
    <?php if ($site['logo'] !== ''): ?><img class="logo" style="margin:0 auto 16px" src="<?= $h($img($site['logo'])) ?>" alt=""><?php endif; ?>
    <h1><?= $h($site['title']) ?></h1>
    <?php if ($site['tagline'] !== ''): ?><p class="tag" style="margin-left:auto;margin-right:auto"><?= $h($site['tagline']) ?></p><?php endif; ?>
    <button class="btn" data-chat="Hi! I'd like to place an order.">Order in chat</button>
  </div>
</header>
<main class="wrap" style="max-width:760px">
  <?php if ($site['about'] !== ''): ?><section class="about card"><p><?= $nl($site['about']) ?></p></section><?php endif; ?>
  <?php if (!$groups): ?><div class="card empty" style="margin-top:24px">Our menu is being updated. Message us for today's specials.</div><?php endif; ?>
  <?php foreach ($groups as $cat => $list): ?>
  <section class="menu-cat">
    <h2><?= $h($cat) ?></h2>
    <div class="card">
      <?php foreach ($list as $it): ?>
      <div class="dish">
        <?php if ($it['image'] !== ''): ?><img src="<?= $h($img($it['image'])) ?>" alt="<?= $h($it['name']) ?>" loading="lazy"><?php endif; ?>
        <div class="grow">
          <div class="row"><h3><?= $h($it['name']) ?></h3><span class="dots"></span><?php if ($it['price'] !== ''): ?><span class="price"><?= $h($it['price']) ?></span><?php endif; ?></div>
          <?php if ($it['description'] !== ''): ?><p><?= $nl($it['description']) ?></p><?php endif; ?>
          <button class="btn small ghost" data-chat="<?= $h(Sites::chatText($template, $it)) ?>">Add to order</button>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endforeach; ?>
</main>
