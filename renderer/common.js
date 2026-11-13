/* Shared helpers: data lookups, DOM builder, champion autocomplete, rune strip.
   No innerHTML with dynamic data anywhere: everything goes through textContent. */
const ROLES = { '': 'Tous', top: 'Top', jungle: 'Jungle', middle: 'Mid', bottom: 'ADC', utility: 'Support' };
const ROLE_ORDER = ['top', 'jungle', 'middle', 'bottom', 'utility'];

/** Stat shard rows, in the order the client expects them (rows 1 to 3). */
const SHARD_ROWS = [
  [5008, 5005, 5007],
  [5008, 5010, 5001],
  [5011, 5013, 5001],
];
const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/';
const SHARDS = {
  5001: { name: 'PV (échelle)', icon: 'statmodshealthscalingicon' },
  5005: { name: "Vitesse d'attaque", icon: 'statmodsattackspeedicon' },
  5007: { name: 'Accélération de compétence', icon: 'statmodscdrscalingicon' },
  5008: { name: 'Force adaptative', icon: 'statmodsadaptiveforceicon' },
  5010: { name: 'Vitesse de déplacement', icon: 'statmodsmovementspeedicon' },
  5011: { name: 'PV', icon: 'statmodshealthplusicon' },
  5013: { name: 'Ténacité', icon: 'statmodstenacityicon' },
};

let ddragon = null;
let state = null;

const $ = (id) => document.getElementById(id);

/** Tiny element builder: h('div', {class:'x', onclick: fn}, child, 'text'). */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c != null) el.append(c);
  return el;
}

/** Lowercase, no accents, letters and digits only: "Kai'Sa" and "kaisa" match. */
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const champById = (key) => ddragon.champions.find((c) => c.key === key);
const champName = (key) => (key ? champById(key)?.name ?? `#${key}` : '—');
const champIcon = (key) => {
  const c = champById(key);
  return c ? `https://ddragon.leagueoflegends.com/cdn/${ddragon.version}/img/champion/${c.id}.png` : '';
};
const runeIcon = (icon) => `https://ddragon.leagueoflegends.com/cdn/img/${icon}`;
const treeById = (id) => ddragon.trees.find((t) => t.id === id);

/** Image that falls back to a text label if it fails to load. */
function img(src, cls, title, fallback) {
  const el = h('img', { src, class: cls || '', title: title || '', alt: title || '' });
  el.addEventListener('error', () => {
    const span = h('span', { class: `${cls || ''} imgfallback`, title: title || '' }, fallback || '?');
    el.replaceWith(span);
  });
  return el;
}

const shardImg = (id, cls) =>
  img(`${CDRAGON}${SHARDS[id]?.icon}.png`, cls, SHARDS[id]?.name ?? String(id), (SHARDS[id]?.name ?? '?').slice(0, 2));

function runeImg(id, cls) {
  const r = ddragon.runes[id];
  return r ? img(runeIcon(r.icon), cls, r.name, r.name.slice(0, 2)) : h('span', { class: cls }, '?');
}

/**
 * Champion autocomplete. Type to filter, arrows + Enter or click to pick.
 * Returns { el, get(), set(key), focus() }.
 */
function createChampionPicker({ placeholder, clearable = false, onChange = () => {} }) {
  let selected = 0;
  let active = 0;
  let matches = [];

  const icon = h('span', { class: 'picker-icon' });
  const input = h('input', { type: 'text', placeholder, autocomplete: 'off', spellcheck: 'false' });
  const clear = h('button', { class: 'picker-clear', type: 'button', title: 'Effacer', hidden: '' }, '×');
  const list = h('ul', { class: 'picker-list', hidden: '' });
  const el = h('div', { class: 'picker' }, icon, input, clearable ? clear : null, list);

  function refreshIcon() {
    icon.replaceChildren();
    if (selected) icon.append(h('img', { src: champIcon(selected), alt: '' }));
    icon.classList.toggle('has-icon', Boolean(selected));
    clear.hidden = !(clearable && (selected || input.value));
  }

  function choose(key) {
    selected = key;
    input.value = key ? champName(key) : '';
    list.hidden = true;
    refreshIcon();
    onChange(key);
  }

  function renderList() {
    const q = norm(input.value);
    matches = ddragon.champions
      .map((c) => ({ c, i: norm(c.name).indexOf(q) }))
      .filter((m) => m.i >= 0)
      .sort((a, b) => (a.i === 0 ? 0 : 1) - (b.i === 0 ? 0 : 1) || a.c.name.localeCompare(b.c.name, 'fr'))
      .slice(0, 8)
      .map((m) => m.c);
    active = 0;
    list.replaceChildren(
      ...matches.map((c, i) =>
        h('li', {
          class: i === active ? 'active' : '',
          // mousedown (not click) so the input does not lose focus first
          onmousedown: (e) => { e.preventDefault(); choose(c.key); },
        }, h('img', { src: champIcon(c.key), alt: '' }), h('span', {}, c.name)),
      ),
    );
    list.hidden = matches.length === 0;
  }

  function highlight() {
    [...list.children].forEach((li, i) => li.classList.toggle('active', i === active));
  }

  input.addEventListener('focus', () => { input.select(); renderList(); });
  input.addEventListener('input', () => {
    if (selected) { selected = 0; onChange(0); }
    refreshIcon();
    renderList();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && matches.length) { active = (active + 1) % matches.length; highlight(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && matches.length) { active = (active - 1 + matches.length) % matches.length; highlight(); e.preventDefault(); }
    else if (e.key === 'Enter' && matches[active]) { choose(matches[active].key); e.preventDefault(); }
    else if (e.key === 'Escape') list.hidden = true;
  });
  input.addEventListener('blur', () => {
    list.hidden = true;
    if (selected) return;
    const exact = ddragon.champions.find((c) => norm(c.name) === norm(input.value));
    if (exact) choose(exact.key);
    else { input.value = ''; refreshIcon(); }
  });
  clear.addEventListener('mousedown', (e) => { e.preventDefault(); choose(0); });

  return {
    el,
    get: () => selected,
    set: (key) => { selected = key || 0; input.value = selected ? champName(selected) : ''; refreshIcon(); },
    focus: () => input.focus(),
  };
}

/** Compact visual summary of a rune page: keystone, minor runes, secondary tree, shards. */
function runeStrip(page) {
  const ids = page.selectedPerkIds;
  const prim = ddragon.styles[page.primaryStyleId];
  const sub = ddragon.styles[page.subStyleId];
  const col = (...children) => h('div', { class: 'rs-col' }, ...children);
  return h('div', { class: 'rs' },
    col(runeImg(ids[0], 'rs-key')),
    col(...ids.slice(1, 4).map((id) => runeImg(id, 'rs-minor'))),
    h('div', { class: 'rs-sep' }),
    col(
      sub ? img(runeIcon(sub.icon), 'rs-tree', sub.name, sub.name.slice(0, 2)) : null,
      ...ids.slice(4, 6).map((id) => runeImg(id, 'rs-minor')),
    ),
    h('div', { class: 'rs-sep' }),
    col(...ids.slice(6, 9).map((id) => shardImg(id, 'rs-shard'))),
    prim ? null : null,
  );
}
