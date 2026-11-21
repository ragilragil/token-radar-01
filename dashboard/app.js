// Token Launch Radar dashboard. Reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, filters, a
// per-protocol detail view with the model's own inputs, and the live-token
// comparators. No network: every byte it shows is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var rows = DATA.rows || [];
  var live = DATA.live || [];
  var model = DATA.model || {};
  var state = { q: '', cat: 'all', chain: 'all', sort: 'value', watch: false, early: false, selected: null };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.round(days) + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // The model in one function: the page recomputes a row from the snapshot
  // figures and checks the number board.json carries, so the page's code
  // and the board's data are visibly the same arithmetic.
  function impliedOf(row) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var breadth = 1 + Math.min(Math.max(row.chains.length - 1, 0), model.breadth_max_chains) * model.breadth_step;
    return Math.max(1, Math.round(row.tvl_usd * row.category_ratio * growthMult * maturity * breadth));
  }

  // The farm plan is the same derivation main.ts writes to board.json:
  // category, chains, TVL and age decide the action, the capital, the hold
  // and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and borrow a small amount against it, then repay the borrow.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ', in the pair the app suggests, and keep the position open.';
    if (c.indexOf('yield') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s highest-TVL yield vault on " + chain + ' and keep the shares.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then use the bridged funds in one app on that chain.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' on ' + chain + ' and keep the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' on ' + chain + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' on ' + name + ' and place one small position on a market that closes within a week.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares in the same wallet.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it for the full period.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + " of " + name + "'s yield-bearing asset on " + chain + ' and hold it in the farming wallet.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active for the full period.';
    if (c.indexOf('payment') >= 0) return 'Send two payments totalling $' + capital + ' through ' + name + ' on ' + chain + ', a week apart, from the farming wallet.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and use one of its core features in the same week.';
  }
  function weeklyFor(p, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Once a week, adjust the ' + name + ' position a little: add or remove a small supply, or make a borrow and repay it.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Once a week, make one small swap or rebalance inside ' + name + ' on ' + chain + ' so the wallet stays active.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 'Once a week, bridge a small amount through ' + name + ' to a second chain it supports and back again.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Once a week, open and close one small position on ' + name + ' on ' + chain + ' with a tight stop.';
    if (c.indexOf('prediction') >= 0) return 'Once a week, place one small position on a fresh ' + name + ' market and let it settle.';
    return 'Once a week, make one qualifying action in ' + name + ' on ' + chain + ', such as a deposit, a swap, a vote or a claim.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var secondChain = p.chains.length > 1 ? p.chains[1] : chain;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: weeklyFor(p, chain), cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Repeat the position on a second chain, ' + secondChain + ', with a smaller amount, so the wallet shows activity in more than one place.', cost: 'about $25 of capital and $3 of gas', time: '15 minutes' },
      { text: 'Hold the main position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open " + p.name + "'s own points or rewards page from the link its app publishes and claim only from there, never from a link in a message.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' }
    ].map(stepText);
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.watch && !r.on_watchlist) return false;
      if (state.early && r.on_watchlist) return false;
      if (state.cat !== 'all' && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (state.sort === 'tvl') list.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    else if (state.sort === 'growth') list.sort(function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); });
    else if (state.sort === 'age') list.sort(function (a, b) { return (b.age_days || 0) - (a.age_days || 0); });
    else list.sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; });
    return list;
  }

  function renderStats() {
    document.getElementById('asOf').textContent = DATA.as_of;
    document.getElementById('source').textContent = DATA.source;
    document.getElementById('floor').textContent = fmtUsd(DATA.floor_usd);
    var top = rows[0];
    document.getElementById('stats').innerHTML =
      '<div class="stat"><b>' + rows.length + '</b><span>protocols ranked</span></div>' +
      '<div class="stat"><b>' + DATA.watchlist_size + '</b><span>on the watchlist</span></div>' +
      '<div class="stat"><b>' + DATA.early_size + '</b><span>early rows below the floor</span></div>' +
      '<div class="stat"><b>' + DATA.global_ratio.toFixed(3) + '</b><span>global mcap / TVL ratio</span></div>' +
      '<div class="stat"><b>' + (top ? esc(top.name) : 'n/a') + '</b><span>top pick &middot; ' + (top ? fmtUsd(top.implied_value_usd) : '') + '</span></div>';
  }

  function renderFilters() {
    var cats = {};
    rows.forEach(function (r) { cats[r.category || 'Uncategorised'] = true; });
    var catSel = document.getElementById('cat');
    catSel.innerHTML = '<option value="all">All categories</option>' + Object.keys(cats).sort().map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
    var chains = {};
    rows.forEach(function (r) { r.chains.forEach(function (c) { chains[c] = true; }); });
    document.getElementById('chain').innerHTML = '<option value="all">All chains</option>' + Object.keys(chains).sort().map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
  }

  function renderBoard() {
    var list = filtered();
    document.getElementById('count').textContent = list.length + ' of ' + rows.length + ' protocols shown';
    var html = list.map(function (r) {
      var g = r.change_7d;
      var cls = g === null ? '' : (g >= 0 ? 'up' : 'down');
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong>' + (r.on_watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</td>' +
        '<td>' + esc(r.category || 'Uncategorised') + '</td>' +
        '<td>' + r.chains.slice(0, 2).map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + (r.chains.length > 2 ? '<span class="chip">+' + (r.chains.length - 2) + '</span>' : '') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + cls + '">' + fmtPct(g) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num"><strong>' + fmtUsd(r.implied_value_usd) + '</strong></td></tr>';
    }).join('');
    document.getElementById('rows').innerHTML = html || '<tr><td colspan="8">No protocols match this filter.</td></tr>';
    document.querySelectorAll('#rows tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { state.selected = tr.getAttribute('data-slug'); renderBoard(); renderDetail(); });
    });
  }

  function renderDetail() {
    var box = document.getElementById('detail');
    var r = rows.find(function (x) { return x.slug === state.selected; }) || rows[0];
    if (!r) { box.innerHTML = ''; return; }
    var recomputed = impliedOf(r);
    var steps = farmSteps(r);
    box.innerHTML =
      '<h2>#' + r.rank + ' &middot; ' + esc(r.name) + (r.on_watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="meta">' + esc(r.category || 'Uncategorised') + ' &middot; ' + r.chains.map(esc).join(', ') + ' &middot; TVL ' + fmtUsd(r.tvl_usd) +
      ' &middot; 7d ' + fmtPct(r.change_7d) + ' &middot; listed ' + (r.listed_at || 'unknown') + ' (' + fmtAge(r.age_days) + ') &middot; records no token</p>' +
      '<h3>Implied value: ' + fmtUsd(r.implied_value_usd) + '</h3>' +
      '<p class="formula"><code>' + fmtUsd(r.tvl_usd) + ' TVL &times; ' + r.category_ratio.toFixed(3) + ' category ratio &times; ' +
      r.growth_multiplier.toFixed(2) + ' growth &times; ' + r.maturity_multiplier.toFixed(2) + ' maturity &times; ' +
      r.breadth_multiplier.toFixed(2) + ' breadth = ' + fmtUsd(recomputed) + '</code></p>' +
      '<p class="note">The page recomputes the value from the snapshot figures above; the board carries ' + fmtUsd(r.implied_value_usd) + '.</p>' +
      '<h3>How to farm it</h3><ol class="steps">' +
      steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
  }

  function renderLive() {
    document.getElementById('liveRows').innerHTML = live.map(function (r) {
      return '<tr><td><strong>' + esc(r.name) + '</strong></td><td>' + esc(r.category || 'Uncategorised') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + fmtUsd(r.mcap_usd) + '</td>' +
        '<td class="num">' + (r.mcap_tvl_ratio === null ? 'n/a' : r.mcap_tvl_ratio.toFixed(3)) + '</td></tr>';
    }).join('');
  }

  function bind() {
    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
    document.getElementById('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
    document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
    document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });
    document.getElementById('watch').addEventListener('change', function (e) { state.watch = e.target.checked; renderBoard(); });
    document.getElementById('early').addEventListener('change', function (e) { state.early = e.target.checked; renderBoard(); });
  }

  renderStats();
  renderFilters();
  bind();
  renderBoard();
  renderDetail();
  renderLive();
})();
