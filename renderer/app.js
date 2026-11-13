/* App shell: tabs, toast, champion select tab, notes tab, boot. */
const TABS = ['library', 'editor', 'select', 'notes'];
let adviceKey = '';
let selectKey = '';
let lastToastAt = 0;
let toastTimer = null;

const cleanError = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': Error: /, '');

function toast(text, kind) {
  const el = $('toast');
  el.textContent = text;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), kind === 'err' ? 12000 : 4000);
}

function showTab(name) {
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  for (const t of TABS) $(`tab-${t}`).hidden = t !== name;
  if (name === 'library') renderLibrary();
  if (name === 'notes') renderNotes();
}

document.querySelectorAll('nav button').forEach((btn) => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

/* ---------- Champion select tab ---------- */
function renderSelect() {
  const sel = state.select;
  const key = JSON.stringify([state.lcuConnected, sel, state.enemyChampionId, state.lastImport]);
  if (key === selectKey) return;
  selectKey = key;

  const card = $('select-card');
  card.replaceChildren(h('h2', {}, 'Sélection des champions'));
  if (!state.lcuConnected) {
    card.append(h('p', { class: 'hint' }, 'Lance le client LoL : la connexion est automatique.'));
    return;
  }
  if (!sel.active) {
    card.append(h('p', { class: 'hint' }, "En attente d'une sélection des champions…"));
    return;
  }

  card.append(
    h('div', { class: 'row' },
      sel.myChampionId ? h('img', { class: 'page-champ', src: champIcon(sel.myChampionId), alt: '' }) : null,
      h('div', {},
        h('strong', {}, champName(sel.myChampionId)),
        h('div', { class: 'hint' }, `${ROLES[sel.role] ?? 'Rôle inconnu'} · ${sel.locked ? 'verrouillé' : 'en survol'}`),
      ),
    ),
  );

  const enemy = createChampionPicker({
    placeholder: 'Adversaire de lane (non détecté)',
    clearable: true,
    onChange: (k) => window.api.setEnemy(k),
  });
  enemy.set(state.enemyChampionId);
  card.append(h('label', {}, 'Adversaire de lane (modifiable à la main)', enemy.el));
  card.append(h('button', { class: 'primary', type: 'button', onclick: () => window.api.importNow() }, 'Importer la page maintenant'));
}

async function renderAdvice() {
  const card = $('advice-card');
  const sel = state.select;
  const key = `${sel.active}:${sel.myChampionId}:${state.enemyChampionId}`;
  if (key === adviceKey) return;
  adviceKey = key;
  card.replaceChildren();
  if (!sel.active || !sel.myChampionId) return;

  const advice = await window.api.getAdvice(sel.myChampionId, state.enemyChampionId);
  if (key !== adviceKey) return; // state moved on while loading
  card.append(h('h2', {}, 'Conseils'));

  const section = (title, items) => {
    if (!items.length) return;
    card.append(h('strong', {}, title), h('ul', { class: 'tips' }, ...items.map((t) => h('li', {}, t))));
  };
  if (advice.notes.length) {
    card.append(h('strong', {}, 'Tes notes'));
    for (const n of advice.notes) {
      const tag = n.vsChampionId ? `contre ${champName(n.vsChampionId)}` : 'général';
      card.append(h('div', { class: 'note' }, `[${tag}] ${n.text}`));
    }
  }
  section(`Jouer ${champName(sel.myChampionId)}`, advice.allyTips);
  if (state.enemyChampionId) section(`Jouer contre ${champName(state.enemyChampionId)}`, advice.enemyTips);
}

/* ---------- Notes tab ---------- */
let notePickers = null;

async function renderNotes() {
  const notes = await window.api.listNotes();
  const list = $('nt-list');
  list.replaceChildren();
  if (!notes.length) list.append(h('p', { class: 'hint' }, "Aucune note pour l'instant."));
  for (const n of notes) {
    const title = n.vsChampionId
      ? `${champName(n.championId)} contre ${champName(n.vsChampionId)}`
      : `${champName(n.championId)} (général)`;
    list.append(
      h('div', { class: 'card' },
        h('div', { class: 'row' },
          h('img', { class: 'mini', src: champIcon(n.championId), alt: '' }),
          h('strong', {}, title),
        ),
        h('div', { class: 'note' }, n.text),
        confirmButton('Supprimer', async () => { await window.api.deleteNote(n.id); renderNotes(); }),
      ),
    );
  }
}

function buildNotes() {
  notePickers = {
    champ: createChampionPicker({ placeholder: 'Tape un champion…' }),
    vs: createChampionPicker({ placeholder: 'Contre… (optionnel)', clearable: true }),
  };
  $('nt-champ').append(notePickers.champ.el);
  $('nt-vs').append(notePickers.vs.el);
  $('nt-save').addEventListener('click', async () => {
    const text = $('nt-text').value.trim();
    if (!notePickers.champ.get()) return toast('Choisis un champion pour la note.', 'err');
    if (!text) return;
    await window.api.addNote({
      championId: notePickers.champ.get(),
      vsChampionId: notePickers.vs.get() || null,
      text,
    });
    $('nt-text').value = '';
    renderNotes();
  });
}

/* ---------- Boot ---------- */
function applyState(s) {
  state = s;
  const li = s.lastImport;
  if (li && li.at !== lastToastAt) {
    lastToastAt = li.at;
    toast(li.error ? `Import échoué : ${li.error}` : `Page importée dans le client : ${li.pageName}`, li.error ? 'err' : 'ok');
  }
  const st = $('status');
  st.textContent = `Client LoL : ${s.lcuConnected ? 'connecté' : 'déconnecté'}`;
  st.className = `status ${s.lcuConnected ? 'on' : 'off'}`;
  renderSelect();
  renderAdvice();
}

/* ---------- Theme switcher ---------- */
function buildThemeSwitcher() {
  const box = $('themes');
  const paint = () => {
    const current = document.documentElement.dataset.theme;
    box.replaceChildren(
      ...THEMES.map((t) =>
        h('button', {
          type: 'button',
          class: `theme-btn${t.id === current ? ' on' : ''}`,
          title: t.label,
          'aria-pressed': String(t.id === current),
          onclick: () => { setTheme(t.id); paint(); },
        }, h('span', { class: 'theme-emoji' }, t.emoji), h('span', { class: 'theme-label' }, t.label)),
      ),
    );
  };
  paint();
}

buildThemeSwitcher();

(async () => {
  try {
    ddragon = await window.api.getData();
  } catch {
    $('tab-library').textContent = 'Impossible de charger les données Riot (connexion internet ?).';
    return;
  }
  buildLibrary();
  buildEditor($('tab-editor'));
  buildNotes();
  window.api.onState(applyState);
  // Ignore an import result that happened before this window opened.
  const initial = await window.api.getState();
  lastToastAt = initial.lastImport?.at ?? 0;
  applyState(initial);
  showTab('library');
})();
