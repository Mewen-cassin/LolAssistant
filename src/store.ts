import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface RunePage {
  id: string;
  name: string;
  championId: number;
  /** "" = any role, otherwise top | jungle | middle | bottom | utility. */
  role: string;
  /** Matchup-specific page when set, otherwise a default page for the champion. */
  vsChampionId: number | null;
  primaryStyleId: number;
  subStyleId: number;
  selectedPerkIds: number[];
}

export interface Note {
  id: string;
  championId: number;
  /** Matchup note when set, otherwise a general note for the champion. */
  vsChampionId: number | null;
  text: string;
}

interface StoreData {
  pages: RunePage[];
  notes: Note[];
}

/** Tiny JSON-file persistence for rune pages and matchup notes. */
export class Store {
  private data: StoreData = { pages: [], notes: [] };

  constructor(private readonly file: string) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.data = { pages: parsed.pages ?? [], notes: parsed.notes ?? [] };
    } catch {
      /* first run or unreadable file: start empty */
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  get pages(): RunePage[] {
    return this.data.pages;
  }

  get notes(): Note[] {
    return this.data.notes;
  }

  addPage(page: Omit<RunePage, 'id'>): RunePage {
    const created = { ...page, id: randomUUID() };
    this.data.pages.push(created);
    this.save();
    return created;
  }

  /** Replaces the content of an existing page, keeping its id. */
  updatePage(id: string, page: Omit<RunePage, 'id'>): RunePage | null {
    const index = this.data.pages.findIndex((p) => p.id === id);
    if (index < 0) return null;
    const updated = { ...page, id };
    this.data.pages[index] = updated;
    this.save();
    return updated;
  }

  deletePage(id: string): void {
    this.data.pages = this.data.pages.filter((p) => p.id !== id);
    this.save();
  }

  addNote(note: Omit<Note, 'id'>): Note {
    const created = { ...note, id: randomUUID() };
    this.data.notes.push(created);
    this.save();
    return created;
  }

  deleteNote(id: string): void {
    this.data.notes = this.data.notes.filter((n) => n.id !== id);
    this.save();
  }
}
