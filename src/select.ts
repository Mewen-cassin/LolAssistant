import type { RunePage } from './store';

/** What we know about the local player's champion select. */
export interface SelectState {
  active: boolean;
  myChampionId: number;
  /** Assigned lane: top | jungle | middle | bottom | utility | "". */
  role: string;
  /** Lane opponent if the client reveals it, otherwise 0. */
  enemyChampionId: number;
  /** True once the local player has locked in their pick. */
  locked: boolean;
}

export const IDLE: SelectState = { active: false, myChampionId: 0, role: '', enemyChampionId: 0, locked: false };

/** Extracts the relevant state from a raw `/lol-champ-select/v1/session` payload. */
export function parseSession(session: any): SelectState {
  if (!session) return IDLE;
  const local = session.localPlayerCellId;
  const me = (session.myTeam ?? []).find((p: any) => p.cellId === local);
  if (!me) return IDLE;

  const role: string = me.assignedPosition ?? '';
  const enemy = (session.theirTeam ?? []).find(
    (p: any) => p.championId > 0 && role !== '' && p.assignedPosition === role,
  );
  const actions: any[] = (session.actions ?? []).flat();
  const locked = actions.some((a) => a.actorCellId === local && a.type === 'pick' && a.completed);

  return {
    active: true,
    myChampionId: me.championId || me.championPickIntent || 0,
    role,
    enemyChampionId: enemy?.championId ?? 0,
    locked,
  };
}

/**
 * Picks the best saved page for the situation:
 * exact matchup > role-specific > any-role default. Pages for another
 * matchup or another role are never used.
 */
export function pickPage(
  pages: RunePage[],
  championId: number,
  role: string,
  enemyChampionId: number,
): RunePage | null {
  let best: RunePage | null = null;
  let bestScore = -1;
  for (const page of pages) {
    if (page.championId !== championId) continue;
    if (page.vsChampionId !== null && page.vsChampionId !== enemyChampionId) continue;
    if (page.role !== '' && role !== '' && page.role !== role) continue;
    if (page.role !== '' && role === '') continue;
    const score = (page.vsChampionId !== null ? 4 : 0) + (page.role !== '' ? 2 : 0);
    if (score > bestScore) {
      best = page;
      bestScore = score;
    }
  }
  return best;
}
