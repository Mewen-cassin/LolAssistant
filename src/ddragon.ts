const BASE = 'https://ddragon.leagueoflegends.com';
const LOCALE = 'fr_FR';

export interface Champion {
  /** Data Dragon id, e.g. "MonkeyKing" (used in image URLs). */
  id: string;
  /** Numeric id as used by the client, e.g. 62. */
  key: number;
  name: string;
}

export interface RuneInfo {
  name: string;
  icon: string;
}

/** A rune tree (Précision, Domination…) with its rows: row 0 = keystones, rows 1-3 = minor runes. */
export interface Tree extends RuneInfo {
  id: number;
  slots: (RuneInfo & { id: number })[][];
}

export interface DdragonData {
  version: string;
  champions: Champion[];
  runes: Record<number, RuneInfo>;
  styles: Record<number, RuneInfo>;
  trees: Tree[];
}

export interface ChampionTips {
  allyTips: string[];
  enemyTips: string[];
}

let data: DdragonData | null = null;
const tipsCache = new Map<string, ChampionTips>();

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Loads champions and runes for the latest patch. Safe to call again to retry. */
export async function loadDdragon(): Promise<DdragonData> {
  if (data) return data;
  const versions = await getJson<string[]>(`${BASE}/api/versions.json`);
  const version = versions[0];
  const champJson = await getJson<{ data: Record<string, any> }>(
    `${BASE}/cdn/${version}/data/${LOCALE}/champion.json`,
  );
  const runeJson = await getJson<any[]>(`${BASE}/cdn/${version}/data/${LOCALE}/runesReforged.json`);

  const champions: Champion[] = Object.values(champJson.data)
    .map((c: any) => ({ id: c.id as string, key: Number(c.key), name: c.name as string }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const runes: Record<number, RuneInfo> = {};
  const styles: Record<number, RuneInfo> = {};
  const trees: Tree[] = [];
  for (const style of runeJson) {
    styles[style.id] = { name: style.name, icon: style.icon };
    const slots: Tree['slots'] = [];
    for (const slot of style.slots) {
      const row = slot.runes.map((r: any) => ({ id: r.id as number, name: r.name as string, icon: r.icon as string }));
      for (const rune of row) runes[rune.id] = { name: rune.name, icon: rune.icon };
      slots.push(row);
    }
    trees.push({ id: style.id, name: style.name, icon: style.icon, slots });
  }
  data = { version, champions, runes, styles, trees };
  return data;
}

export function championById(key: number): Champion | undefined {
  return data?.champions.find((c) => c.key === key);
}

/** Official "play with / play against" tips for a champion. */
export async function getTips(key: number): Promise<ChampionTips> {
  const champ = championById(key);
  if (!data || !champ) return { allyTips: [], enemyTips: [] };
  const cached = tipsCache.get(champ.id);
  if (cached) return cached;
  const json = await getJson<{ data: Record<string, any> }>(
    `${BASE}/cdn/${data.version}/data/${LOCALE}/champion/${champ.id}.json`,
  );
  const entry = json.data[champ.id];
  const tips: ChampionTips = {
    allyTips: entry?.allytips ?? [],
    enemyTips: entry?.enemytips ?? [],
  };
  tipsCache.set(champ.id, tips);
  return tips;
}
