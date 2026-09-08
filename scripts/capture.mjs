import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sessions = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions');
const output = path.join(root, '.agent-logs');
const normalize = p => path.resolve(p).toLowerCase();
const seen = new Map();
function files(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.jsonl') ? [path.join(dir, e.name)] : []); } catch { return []; }
}
export function capture() {
  fs.mkdirSync(output, { recursive: true });
  for (const file of files(sessions)) {
    const stat = fs.statSync(file);
    if (stat.mtimeMs < Date.parse('2026-09-08T09:38:00Z')) continue;
    if (seen.get(file) === stat.size) continue;
    seen.set(file, stat.size);
    const rows = fs.readFileSync(file, 'utf8').split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const meta = rows.find(r => r.type === 'session_meta')?.payload;
    if (!meta?.cwd || normalize(meta.cwd) !== normalize(root) || typeof meta.source === 'object') continue;
    let model = rows.find(r => r.type === 'turn_context')?.payload?.model || 'unknown';
    const events = [];
    let count = 0;
    const modern = rows.some(r => r.type === 'event_msg' && r.payload?.type === 'item_completed' && r.payload.item?.type === 'UserMessage');
    for (const row of rows) {
      const p = row.payload;
      if (row.type === 'turn_context' && p.model) model = p.model;
      let kind, body;
      if (modern && row.type === 'event_msg' && p.type === 'item_completed' && p.item?.type === 'UserMessage') {
        kind = 'PROMPT'; body = p.item.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      } else if (!modern && row.type === 'event_msg' && p.type === 'user_message') {
        kind = 'PROMPT'; body = p.message;
      } else if (row.type === 'response_item' && p.type === 'message' && p.role === 'assistant' && ['final', 'final_answer'].includes(p.phase)) {
        kind = 'RESPONSE'; body = p.content.filter(c => c.type === 'output_text').map(c => c.text).join('\n');
      }
      if (kind && typeof body === 'string') { if (kind === 'PROMPT') count++; events.push({ kind, body, num: count, time: row.timestamp, model }); }
    }
    if (!events.length) continue;
    const first = events.find(e => e.kind === 'PROMPT');
    const last = events.findLast(e => e.kind === 'PROMPT');
    const start = first.time.replace(/:/g, '-').replace('T', '_').slice(0, 19);
    const target = path.join(output, `${start}_${meta.id}.md`);
    const short = meta.id.slice(0, 8);
    const header = `---\nsession_id: ${meta.id}\ndate: ${first.time.slice(0, 10)}\nauthor: Huzyefahwasim\nmodel: ${events[0].model}\ntool: ${meta.originator || 'codex-cli'}\nproject: UGC-\ntotal_exchanges: ${count}\nfirst_prompt_time: ${first.time}\nlast_prompt_time: ${last.time}\n---\n\n# Session Log - ${first.time.slice(0, 10)}\n\nSession: \`${short}\` | Project: \`UGC-\` | Author: \`Huzyefahwasim\`\n\n---\n\n`;
    const entries = events.map(e => `[LOG_ENTRY type=${e.kind} num=${e.num} session=${short}]\ntimestamp: ${e.time}\nmodel: ${e.model}\n\n${e.body}\n\n`).join('\n');
    if (fs.existsSync(target)) {
      const old = fs.readFileSync(target, 'utf8').split('\n\n---\n\n')[1];
      if (old && !entries.startsWith(old)) throw new Error(`Refusing to rewrite captured entries: ${target}`);
    }
    const document = header + entries;
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== document) fs.writeFileSync(target, document, 'utf8');
  }
}
capture();
if (process.argv.includes('--watch')) setInterval(() => { try { capture(); } catch(e) { console.error(e.message); } }, 1500);
