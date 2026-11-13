/* Library: search saved rune pages by champion name, import / edit / delete. */
let libraryFilter = null;

function confirmButton(label, onConfirm) {
  const btn = h('button', { class: 'small danger', type: 'button' }, label);
  let armed = false;
  let timer = null;
  btn.addEventListener('click', () => {
    if (armed) return onConfirm();
    armed = true;
    btn.textContent = 'Confirmer ?';
    timer = setTimeout(() => { armed = false; btn.textContent = label; }, 3000);
  });
  btn.addEventListener('blur', () => { clearTimeout(timer); armed = false; btn.textContent = label; });
  return btn;
}

function pageCard(p) {
  return h('div', { class: 'page-card' },
    h('div', { class: 'page-head' },
      h('img', { class: 'page-champ', src: champIcon(p.championId), alt: '' }),
      h('div', { class: 'page-title' },
        h('strong', {}, p.name),
        h('div', { class: 'badges' },
          h('span', { class: 'badge' }, ROLES[p.role]),
          p.vsChampionId ? h('span', { class: 'badge vs' }, `vs ${champName(p.vsChampionId)}`) : null,
        ),
      ),
    ),
    runeStrip(p),
    h('div', { class: 'page-actions' },
      h('button', { class: 'small primary', type: 'button', onclick: () => window.api.importPage(p.id) }, 'Importer'),
      h('button', { class: 'small', type: 'button', onclick: () => { loadIntoEditor(p); showTab('editor'); } }, 'Modifier'),
      confirmButton('Supprimer', async () => { await window.api.deletePage(p.id); renderLibrary(); }),
    ),
  );
}

async function renderLibrary() {
  const pages = await window.api.listPages();
  const list = $('lib-list');
  const q = norm(libraryFilter.value);
  list.replaceChildren();

  const shown = pages.filter((p) => !q || norm(champName(p.championId)).includes(q) || norm(p.name).includes(q));
  $('lib-count').textContent = pages.length
    ? `${shown.length} page${shown.length > 1 ? 's' : ''}${q ? ` sur ${pages.length}` : ''}`
    : '';

  if (!pages.length) {
    list.append(h('div', { class: 'empty' },
      h('p', {}, 'Ta bibliothèque est vide.'),
      h('button', { class: 'primary', type: 'button', onclick: () => showTab('editor') }, 'Créer ma première page'),
    ));
    return;
  }
  if (!shown.length) {
    list.append(h('div', { class: 'empty' }, h('p', {}, 'Aucune page pour cette recherche.')));
    return;
  }

  const byChamp = new Map();
  for (const p of shown) {
    if (!byChamp.has(p.championId)) byChamp.set(p.championId, []);
    byChamp.get(p.championId).push(p);
  }
  const groups = [...byChamp.entries()].sort((a, b) => champName(a[0]).localeCompare(champName(b[0]), 'fr'));
  for (const [champId, group] of groups) {
    list.append(
      h('section', { class: 'champ-group' },
        h('div', { class: 'group-head' },
          h('img', { src: champIcon(champId), alt: '' }),
          h('h3', {}, champName(champId)),
          h('span', { class: 'count' }, String(group.length)),
        ),
        h('div', { class: 'page-grid' }, ...group.map(pageCard)),
      ),
    );
  }
}

function buildLibrary() {
  libraryFilter = $('lib-search');
  libraryFilter.addEventListener('input', renderLibrary);
  $('lib-new').addEventListener('click', () => { loadIntoEditor(null); showTab('editor'); });
}
