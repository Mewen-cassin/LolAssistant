import { contextBridge, ipcRenderer } from 'electron';

/** Narrow, explicit bridge between the UI and the main process. */
contextBridge.exposeInMainWorld('api', {
  getData: () => ipcRenderer.invoke('data:get'),
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (cb: (state: unknown) => void) => ipcRenderer.on('state', (_e, s) => cb(s)),
  setEnemy: (id: number) => ipcRenderer.invoke('enemy:set', id),
  getAdvice: (championId: number, enemyId: number) => ipcRenderer.invoke('advice:get', championId, enemyId),
  listPages: () => ipcRenderer.invoke('pages:list'),
  deletePage: (id: string) => ipcRenderer.invoke('pages:delete', id),
  savePage: (page: unknown) => ipcRenderer.invoke('pages:save', page),
  readClientPage: () => ipcRenderer.invoke('client:currentPage'),
  importPage: (id: string) => ipcRenderer.invoke('import:page', id),
  importNow: () => ipcRenderer.invoke('import:now'),
  listNotes: () => ipcRenderer.invoke('notes:list'),
  addNote: (note: unknown) => ipcRenderer.invoke('notes:add', note),
  deleteNote: (id: string) => ipcRenderer.invoke('notes:delete', id),
});
