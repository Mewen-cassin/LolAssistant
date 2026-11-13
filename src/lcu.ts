import fs from 'node:fs';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

/** Credentials parsed from the League client `lockfile`. */
interface Lockfile {
  port: number;
  password: string;
}

export interface LcuResponse<T = any> {
  status: number;
  data: T;
}

/** Candidate install folders; LOL_PATH env var takes priority. */
function lockfileCandidates(): string[] {
  const out: string[] = [];
  if (process.env.LOL_PATH) out.push(`${process.env.LOL_PATH}\\lockfile`);
  for (const drive of ['C', 'D', 'E', 'F', 'G']) {
    out.push(`${drive}:\\Riot Games\\League of Legends\\lockfile`);
  }
  return out;
}

function readLockfile(): Lockfile | null {
  for (const file of lockfileCandidates()) {
    try {
      // Format: name:pid:port:password:protocol
      const parts = fs.readFileSync(file, 'utf8').trim().split(':');
      if (parts.length >= 5) return { port: Number(parts[2]), password: parts[3] };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/**
 * Talks to the local League client API (LCU): REST calls and the websocket
 * event stream. Only uses the official local client API, never the game process.
 *
 * Events: `status` (boolean connected), `session` (champ select session or null).
 */
export class LcuClient extends EventEmitter {
  private lock: Lockfile | null = null;
  private ws: WebSocket | null = null;
  private timer: NodeJS.Timeout | null = null;
  connected = false;

  /** Starts polling for the client and keeps the connection alive. */
  start(): void {
    this.tick();
    this.timer = setInterval(() => this.tick(), 3000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.ws?.close();
  }

  private setConnected(value: boolean): void {
    if (this.connected === value) return;
    this.connected = value;
    this.emit('status', value);
    if (!value) this.emit('session', null);
  }

  private tick(): void {
    if (this.ws) return;
    const lock = readLockfile();
    if (!lock) {
      this.setConnected(false);
      return;
    }
    this.lock = lock;
    this.openSocket(lock);
  }

  private openSocket(lock: Lockfile): void {
    const ws = new WebSocket(`wss://127.0.0.1:${lock.port}`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`riot:${lock.password}`).toString('base64') },
      rejectUnauthorized: false,
    });
    this.ws = ws;
    ws.on('open', async () => {
      ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-champ-select_v1_session']));
      this.setConnected(true);
      // Catch up if we connected mid champ select.
      try {
        const res = await this.request('GET', '/lol-champ-select/v1/session');
        this.emit('session', res.status === 200 ? res.data : null);
      } catch {
        /* ignore */
      }
    });
    ws.on('message', (raw) => {
      const text = raw.toString();
      if (!text) return;
      try {
        const msg = JSON.parse(text);
        const evt = msg[2];
        if (evt?.uri === '/lol-champ-select/v1/session') {
          this.emit('session', evt.eventType === 'Delete' ? null : evt.data);
        }
      } catch {
        /* ignore malformed event */
      }
    });
    const drop = () => {
      if (this.ws === ws) this.ws = null;
      this.setConnected(false);
    };
    ws.on('close', drop);
    ws.on('error', drop);
  }

  /** Performs a REST call against the client. Throws if the client is not running. */
  request<T = any>(method: string, path: string, body?: unknown): Promise<LcuResponse<T>> {
    const lock = this.lock ?? readLockfile();
    if (!lock) return Promise.reject(new Error('Client LoL introuvable'));
    const payload = body === undefined ? undefined : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          host: '127.0.0.1',
          port: lock.port,
          path,
          method,
          auth: `riot:${lock.password}`,
          rejectUnauthorized: false,
          headers: payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {},
        },
        (res) => {
          let buf = '';
          res.on('data', (c) => (buf += c));
          res.on('end', () => {
            let data: any = buf;
            try {
              data = buf ? JSON.parse(buf) : null;
            } catch {
              /* keep raw text */
            }
            resolve({ status: res.statusCode ?? 0, data });
          });
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }
}
