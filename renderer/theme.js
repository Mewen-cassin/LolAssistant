/* Theme state. Loaded in <head> so the saved theme is applied before first paint (no flash). */
const THEMES = [
  { id: 'dark', label: 'Dark', emoji: '🌑' },
  { id: 'sakura', label: 'Sakura', emoji: '🌸' },
  { id: 'sunset', label: 'Sunset', emoji: '🌇' },
  { id: 'nighttime', label: 'Nuit', emoji: '✨' },
];

function loadTheme() {
  try {
    const saved = localStorage.getItem('lola-theme');
    if (THEMES.some((t) => t.id === saved)) return saved;
  } catch {
    /* storage can be unavailable: fall back to the default */
  }
  return 'dark';
}

function setTheme(id) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem('lola-theme', id);
  } catch {
    /* not persisted, still applied for this session */
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: id }));
}

document.documentElement.dataset.theme = loadTheme();
