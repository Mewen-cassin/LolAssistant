import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { LcuClient } from './lcu';
import { Store, RunePage } from './store';
import { IDLE, SelectState, parseSession, pickPage } from './select';
import { championById, getTips, loadDdragon } from './ddragon';

/** Pages we push into the client are prefixed so we can find and replace them. */
const CLIENT_PREFIX = '[A] ';

interface ImportResult {
  pageName: string;
  at: number;
  error?: string;
}

const lcu = new LcuClient();
let store: Store;
let win: BrowserWindow | null = null;

let sel: SelectState = IDLE;
/** Enemy champion chosen by hand when the client does not reveal the lane opponent. */
let manualEnemy = 0;
let lastImport: ImportResult | null = null;
/** Avoids re-importing the same page over and over on every session update. */
let lastImportKey = '';

function effectiveEnemy(): number {
  return manualEnemy || sel.enemyChampionId;
}

function snapshot() {
  return {
    lcuConnected: lcu.connected,
    select: sel,
    enemyChampionId: effectiveEnemy(),
    manualEnemy,
    lastImport,
  };
}

function broadcast(): void {
  win?.webContents.send('state', snapshot());
}

/** Replaces our page in the client with `page` and makes it the active one. */
async function importPage(page: RunePage): Promise<ImportResult> {
  const name = (CLIENT_PREFIX + page.name).slice(0, 25);
  try {
    const body = {
      name,
      primaryStyleId: page.primaryStyleId,
      subStyleId: page.subStyleId,
      selectedPerkIds: page.selectedPerkIds,
      current: true,
    };
    const list = await lcu.request<any[]>('GET', '/lol-perks/v1/pages');
    const ours = (list.data ?? []).filter(
      (p) => typeof p.name === 'string' && p.name.startsWith(CLIENT_PREFIX) && p.isEditable !== false,
    );
    // Reuse our own page slot when it exists; never touch the player's other pages.
    const res = ours.length
      ? await lcu.request('PUT', `/lol-perks/v1/pages/${ours[0].id}`, body)
      : await lcu.request('POST', '/lol-perks/v1/pages', body);
    if (res.status >= 400) {
      const full = /max pages/i.test(String(res.data?.message ?? ''));
      const error = full
        ? `Toutes tes pages de runes sont utilisées. Dans le client, renomme une page en "${CLIENT_PREFIX}Assistant" : l'outil l'écrasera à chaque import.`
        : (res.data?.message ?? `HTTP ${res.status}`);
      return { pageName: page.name, at: Date.now(), error };
    }
    return { pageName: page.name, at: Date.now() };
  } catch (e) {
    return { pageName: page.name, at: Date.now(), error: (e as Error).message };
  }
}

/** Imports the best matching page once the pick is locked in. */
async function autoImport(): Promise<void> {
  if (!sel.active || !sel.locked || !sel.myChampionId) return;
  const page = pickPage(store.pages, sel.myChampionId, sel.role, effectiveEnemy());
  if (!page) return;
  const key = `${page.id}:${sel.myChampionId}`;
  if (key === lastImportKey) return;
  lastImportKey = key;
  lastImport = await importPage(page);
  broadcast();
}

function onSession(session: unknown): void {
  sel = parseSession(session);
  if (!sel.active) {
    manualEnemy = 0;
    lastImportKey = '';
  }
  broadcast();
  void autoImport();
}

function registerIpc(): void {
  ipcMain.handle('data:get', async () => {
    const d = await loadDdragon();
    return d;
  });
  ipcMain.handle('state:get', () => snapshot());

  ipcMain.handle('enemy:set', (_e, championId: number) => {
    manualEnemy = championId || 0;
    broadcast();
    void autoImport();
  });

  ipcMain.handle('advice:get', async (_e, championId: number, enemyId: number) => {
    const [mine, theirs] = await Promise.all([
      championId ? getTips(championId).catch(() => null) : null,
      enemyId ? getTips(enemyId).catch(() => null) : null,
    ]);
    const notes = store.notes
      .filter((n) => n.championId === championId && (n.vsChampionId === null || n.vsChampionId === enemyId))
      .sort((a, b) => Number(b.vsChampionId !== null) - Number(a.vsChampionId !== null));
    return {
      allyTips: mine?.allyTips ?? [],
      enemyTips: theirs?.enemyTips ?? [],
      notes,
    };
  });

  ipcMain.handle('pages:list', () => store.pages);
  ipcMain.handle('pages:delete', (_e, id: string) => store.deletePage(id));

  /** Creates a page, or updates it when `id` is given. */
  ipcMain.handle('pages:save', (_e, input: Omit<RunePage, 'id'> & { id?: string }) => {
    if (!championById(input.championId)) throw new Error('Champion invalide.');
    if (!Array.isArray(input.selectedPerkIds) || input.selectedPerkIds.length !== 9) {
      throw new Error('La page de runes doit contenir 9 éléments.');
    }
    const { id, ...page } = input;
    const saved = id ? store.updatePage(id, page) : store.addPage(page);
    if (!saved) throw new Error('Page introuvable.');
    return saved;
  });

  /** Reads the rune page currently active in the League client, to pre-fill the editor. */
  ipcMain.handle('client:currentPage', async () => {
    const res = await lcu.request('GET', '/lol-perks/v1/currentpage');
    const cur = res.data;
    if (res.status !== 200 || !cur || !Array.isArray(cur.selectedPerkIds) || cur.selectedPerkIds.length !== 9) {
      throw new Error('Aucune page de runes complète active dans le client.');
    }
    return {
      primaryStyleId: cur.primaryStyleId as number,
      subStyleId: cur.subStyleId as number,
      selectedPerkIds: cur.selectedPerkIds as number[],
    };
  });

  ipcMain.handle('import:page', async (_e, id: string) => {
    const page = store.pages.find((p) => p.id === id);
    if (!page) return;
    lastImport = await importPage(page);
    broadcast();
  });

  ipcMain.handle('import:now', async () => {
    const page = pickPage(store.pages, sel.myChampionId, sel.role, effectiveEnemy());
    if (!page) {
      lastImport = { pageName: '', at: Date.now(), error: 'Aucune page enregistrée pour cette situation.' };
    } else {
      lastImport = await importPage(page);
    }
    broadcast();
  });

  ipcMain.handle('notes:list', () => store.notes);
  ipcMain.handle('notes:add', (_e, n: { championId: number; vsChampionId: number | null; text: string }) =>
    store.addNote(n),
  );
  ipcMain.handle('notes:delete', (_e, id: string) => store.deleteNote(id));
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1000,
    height: 860,
    minWidth: 760,
    minHeight: 600,
    title: 'LoL Assistant',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    backgroundColor: '#0f1419',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  void win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// Stable identity so the taskbar groups and pins this app under its own icon.
app.setAppUserModelId('com.perso.lol-assistant');

app.whenReady().then(() => {
  store = new Store(path.join(app.getPath('userData'), 'data.json'));
  registerIpc();
  createWindow();
  lcu.on('status', () => broadcast());
  lcu.on('session', onSession);
  lcu.start();
});

app.on('window-all-closed', () => {
  lcu.stop();
  app.quit();
});
