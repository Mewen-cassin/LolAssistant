/* Rune page editor: pick champion, role, optional matchup, then click runes like on U.GG. */
const ed = { id: null, championId: 0, vsId: 0, role: '', name: '', nameTouched: false };
let edRunes = null; // { primary, picks[4], sub, subPicks[{row,id}], shards[3] }
let edUi = null;

function freshRunes() {
  const [first, second] = ddragon.trees;
  return { primary: first.id, picks: [0, 0, 0, 0], sub: second.id, subPicks: [], shards: SHARD_ROWS.map((r) => r[0]) };
}

function autoName() {
  if (!ed.championId) return '';
  const parts = [champName(ed.championId)];
  if (ed.role) parts.push(ROLES[ed.role]);
  if (ed.vsId) parts.push(`vs ${champName(ed.vsId)}`);
  return parts.join(' ');
}

/** Loads a saved page (or nothing, for a blank page) into the editor. */
function loadIntoEditor(page) {
  edRunes = freshRunes();
  Object.assign(ed, { id: null, championId: 0, vsId: 0, role: '', name: '', nameTouched: false });
  if (page) {
    const ids = page.selectedPerkIds;
    Object.assign(ed, {
      id: page.id, championId: page.championId, vsId: page.vsChampionId || 0, role: page.role,
      name: page.name, nameTouched: true,
    });
    edRunes = {
      primary: page.primaryStyleId,
      picks: ids.slice(0, 4),
      sub: page.subStyleId,
      subPicks: ids.slice(4, 6).map((id) => ({ id, row: rowOf(page.subStyleId, id) })),
      shards: ids.slice(6, 9),
    };
  }
  syncEditorUi();
}

function rowOf(treeId, runeId) {
  const tree = treeById(treeId);
  return tree ? tree.slots.findIndex((row) => row.some((r) => r.id === runeId)) : -1;
}

function setMessage(text, kind) {
  edUi.msg.textContent = text || '';
  edUi.msg.className = `ed-msg ${kind || ''}`;
}

function syncEditorUi() {
  edUi.champ.set(ed.championId);
  edUi.vs.set(ed.vsId);
  edUi.name.value = ed.name;
  edUi.name.placeholder = autoName() || 'Nom de la page';
  renderRoleChips();
  renderHero();
  renderRuneArea();
  setMessage('');
  edUi.save.textContent = ed.id ? 'Enregistrer les modifications' : 'Créer la page';
}

function renderHero() {
  const hero = edUi.hero;
  hero.replaceChildren();
  hero.append(
    ed.championId
      ? h('img', { class: 'hero-icon', src: champIcon(ed.championId), alt: '' })
      : h('div', { class: 'hero-icon empty' }, '?'),
    h('div', {},
      h('h2', {}, ed.championId ? champName(ed.championId) : 'Choisis un champion'),
      h('div', { class: 'hero-sub' },
        ed.id ? 'Modification d\'une page' : 'Nouvelle page de runes',
        ed.role ? ` · ${ROLES[ed.role]}` : '',
        ed.vsId ? ` · contre ${champName(ed.vsId)}` : ''),
    ),
  );
}

function renderRoleChips() {
  edUi.roles.replaceChildren(
    ...['', ...ROLE_ORDER].map((r) =>
      h('button', {
        type: 'button',
        class: `chip${ed.role === r ? ' on' : ''}`,
        onclick: () => { ed.role = r; refreshAfterMeta(); renderRoleChips(); },
      }, ROLES[r]),
    ),
  );
}

function refreshAfterMeta() {
  if (!ed.nameTouched) ed.name = autoName();
  edUi.name.value = ed.nameTouched ? ed.name : '';
  edUi.name.placeholder = autoName() || 'Nom de la page';
  renderHero();
}

/* ---------- rune picking ---------- */
function pickPrimary(row, id) {
  edRunes.picks[row] = id;
  renderRuneArea();
}

function pickSub(row, id) {
  const cur = edRunes.subPicks;
  const same = cur.findIndex((p) => p.id === id);
  if (same >= 0) cur.splice(same, 1);
  else {
    const sameRow = cur.findIndex((p) => p.row === row);
    if (sameRow >= 0) cur.splice(sameRow, 1);
    cur.push({ row, id });
    if (cur.length > 2) cur.shift();
  }
  renderRuneArea();
}

function setPrimaryTree(id) {
  if (id === edRunes.primary) return;
  edRunes.primary = id;
  edRunes.picks = [0, 0, 0, 0];
  if (edRunes.sub === id) {
    edRunes.sub = ddragon.trees.find((t) => t.id !== id).id;
    edRunes.subPicks = [];
  }
  renderRuneArea();
}

function setSubTree(id) {
  if (id === edRunes.sub) return;
  edRunes.sub = id;
  edRunes.subPicks = [];
  renderRuneArea();
}

function treeTabs(selectedId, onSelect, excludeId) {
  return h('div', { class: 'tree-tabs' },
    ...ddragon.trees.filter((t) => t.id !== excludeId).map((t) =>
      h('button', {
        type: 'button', title: t.name,
        class: `tree-tab${t.id === selectedId ? ' on' : ''}`,
        onclick: () => onSelect(t.id),
      }, img(runeIcon(t.icon), '', t.name, t.name.slice(0, 2)), h('span', {}, t.name)),
    ),
  );
}

function runeButton(rune, selected, size, onclick) {
  return h('button', {
    type: 'button', title: rune.name,
    class: `rune ${size}${selected ? ' sel' : ''}`,
    onclick,
  }, img(runeIcon(rune.icon), '', rune.name, rune.name.slice(0, 2)));
}

function renderRuneArea() {
  const area = edUi.runes;
  const r = edRunes;
  const prim = treeById(r.primary);
  const sub = treeById(r.sub);

  const primaryCol = h('div', { class: 'col' },
    h('h3', {}, 'Runes principales'),
    treeTabs(r.primary, setPrimaryTree),
    ...prim.slots.map((row, rowIdx) =>
      h('div', { class: `rune-row${rowIdx === 0 ? ' keystones' : ''}` },
        ...row.map((rune) => runeButton(rune, r.picks[rowIdx] === rune.id, rowIdx === 0 ? 'lg' : 'md', () => pickPrimary(rowIdx, rune.id))),
      ),
    ),
  );

  const subCol = h('div', { class: 'col' },
    h('h3', {}, 'Runes secondaires'),
    treeTabs(r.sub, setSubTree, r.primary),
    h('p', { class: 'hint' }, 'Deux runes, sur deux lignes différentes.'),
    ...sub.slots.slice(1).map((row, i) =>
      h('div', { class: 'rune-row' },
        ...row.map((rune) => runeButton(rune, r.subPicks.some((p) => p.id === rune.id), 'md', () => pickSub(i + 1, rune.id))),
      ),
    ),
    h('h3', { class: 'shards-title' }, 'Fragments'),
    ...SHARD_ROWS.map((row, i) =>
      h('div', { class: 'rune-row' },
        ...row.map((id) =>
          h('button', {
            type: 'button', title: SHARDS[id].name,
            class: `rune shard${r.shards[i] === id ? ' sel' : ''}`,
            onclick: () => { r.shards[i] = id; renderRuneArea(); },
          }, shardImg(id, '')),
        ),
      ),
    ),
  );

  area.replaceChildren(primaryCol, subCol);
}

/* ---------- save / fetch from client ---------- */
async function saveEditor() {
  const r = edRunes;
  if (!ed.championId) return setMessage('Choisis un champion.', 'err');
  if (r.picks.some((id) => !id)) return setMessage("Choisis une rune sur chaque ligne de l'arbre principal.", 'err');
  if (r.subPicks.length !== 2) return setMessage('Choisis deux runes secondaires.', 'err');
  const subIds = [...r.subPicks].sort((a, b) => a.row - b.row).map((p) => p.id);
  try {
    const saved = await window.api.savePage({
      id: ed.id || undefined,
      name: (ed.nameTouched ? ed.name : autoName()).trim() || autoName(),
      championId: ed.championId,
      role: ed.role,
      vsChampionId: ed.vsId || null,
      primaryStyleId: r.primary,
      subStyleId: r.sub,
      selectedPerkIds: [...r.picks, ...subIds, ...r.shards],
    });
    toast(`Page enregistrée : ${saved.name}`, 'ok');
    libraryFilter.value = '';
    loadIntoEditor(null);
    showTab('library');
  } catch (e) {
    setMessage(cleanError(e), 'err');
  }
}

async function fetchFromClient() {
  try {
    const cur = await window.api.readClientPage();
    const ids = cur.selectedPerkIds;
    edRunes = {
      primary: cur.primaryStyleId,
      picks: ids.slice(0, 4),
      sub: cur.subStyleId,
      subPicks: ids.slice(4, 6).map((id) => ({ id, row: rowOf(cur.subStyleId, id) })),
      shards: ids.slice(6, 9),
    };
    renderRuneArea();
    setMessage('Page du client copiée dans l\'éditeur.', 'ok');
  } catch (e) {
    setMessage(cleanError(e), 'err');
  }
}

function buildEditor(root) {
  const hero = h('div', { class: 'hero' });
  const champ = createChampionPicker({
    placeholder: 'Tape un champion…',
    onChange: (key) => { ed.championId = key; refreshAfterMeta(); },
  });
  const vs = createChampionPicker({
    placeholder: 'Contre… (optionnel)',
    clearable: true,
    onChange: (key) => { ed.vsId = key; refreshAfterMeta(); },
  });
  const name = h('input', { type: 'text', placeholder: 'Nom de la page', maxlength: '40' });
  name.addEventListener('input', () => { ed.name = name.value; ed.nameTouched = name.value.trim() !== ''; });
  const roles = h('div', { class: 'chips' });
  const runes = h('div', { class: 'rune-area' });
  const msg = h('div', { class: 'ed-msg' });
  const save = h('button', { class: 'primary', type: 'button', onclick: saveEditor }, 'Créer la page');
  const fetchBtn = h('button', { class: 'ghost', type: 'button', onclick: fetchFromClient }, 'Copier la page active du client');
  const reset = h('button', { class: 'ghost', type: 'button', onclick: () => loadIntoEditor(null) }, 'Réinitialiser');

  root.append(
    hero,
    h('div', { class: 'card form-grid' },
      h('label', {}, 'Champion', champ.el),
      h('label', {}, 'Adversaire (matchup)', vs.el),
      h('label', {}, 'Nom', name),
      h('div', { class: 'label' }, 'Rôle', roles),
    ),
    h('div', { class: 'card' }, runes),
    h('div', { class: 'actions' }, save, fetchBtn, reset, msg),
  );
  edUi = { hero, champ, vs, name, roles, runes, msg, save };
  loadIntoEditor(null);
}
