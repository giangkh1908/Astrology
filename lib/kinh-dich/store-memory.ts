/** KinhDichStore trong bộ nhớ, cho test. Hành vi phải khớp store-neon (cùng bộ test hợp đồng). */
import { randomUUID } from 'node:crypto';
import { buildHistory, UUID_RE } from '@/lib/store/chat-store';
import type { LineValue } from './core';
import type { CastSummary, KinhDichStore, Owner } from './store';

interface Conv { id: string; owner: Owner; castId: string; question: string; lines: LineValue[] | null; castAt: string | null; createdAt: string }
interface Msg { id: number; convId: string; role: 'user' | 'assistant'; content: string; hidden: boolean; requestId: string; status: string | null; createdAt: string }

export function createMemoryKinhDichStore(): KinhDichStore {
  const convs: Conv[] = [];
  const msgs: Msg[] = [];
  const requests = new Map<string, string>(); // requestId → convId
  let seq = 0;
  const now = () => new Date(Date.now() + seq++).toISOString();
  const find = (owner: Owner, castId: string) =>
    UUID_RE.test(castId) ? convs.find(c => c.castId === castId && c.owner === (owner ?? null)) : undefined;
  const summary = (c: Conv): CastSummary => ({ castId: c.castId, question: c.question, lines: c.lines ? [...c.lines] : null, castAt: c.castAt, createdAt: c.createdAt });
  const newestFirst = (owner: Owner) => convs.filter(c => c.owner === (owner ?? null)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    enabled: true,
    async createCast(owner, question) {
      const castId = randomUUID();
      convs.push({ id: randomUUID(), owner: owner ?? null, castId, question, lines: null, castAt: null, createdAt: now() });
      return { castId };
    },
    async getCast(owner, castId) {
      const c = find(owner, castId);
      if (!c) return null;
      const own = msgs.filter(m => m.convId === c.id);
      const assistants = own.filter(m => m.role === 'assistant');
      return {
        ...summary(c),
        messages: buildHistory(own.map(m => ({ threadKey: c.castId, updatedAt: m.createdAt, role: m.role, content: m.content, hidden: m.hidden, requestId: m.requestId })))[0]?.messages ?? [],
        lastAssistantStatus: assistants.at(-1)?.status ?? null,
        assistantCount: assistants.length,
      };
    },
    async listCasts(owner, limit) {
      return newestFirst(owner).slice(0, Math.max(0, limit)).map(summary);
    },
    async saveLines(owner, castId, lines, castAt) {
      const c = find(owner, castId);
      if (!c || c.lines) return false;
      c.lines = [...lines];
      c.castAt = castAt ?? now();
      return true;
    },
    async recordTurnStart(owner, castId, t) {
      const c = find(owner, castId);
      if (!c) throw new Error('Không có lần gieo này');
      const requestId = randomUUID();
      requests.set(requestId, c.id);
      msgs.push({ id: msgs.length + 1, convId: c.id, role: 'user', content: t.question, hidden: t.hidden, requestId, status: null, createdAt: now() });
      return { requestId };
    },
    async recordTurnEnd(requestId, r) {
      const convId = requests.get(requestId);
      if (!convId) return;
      requests.delete(requestId);
      msgs.push({ id: msgs.length + 1, convId, role: 'assistant', content: r.text, hidden: false, requestId, status: r.asked ? 'asked' : r.status, createdAt: now() });
    },
    async loadMemoryRows(owner, excludeCastId, limit) {
      const others = newestFirst(owner).filter(c => c.castId !== excludeCastId);
      const ids = new Map(others.map(c => [c.id, c.castId]));
      const notes = msgs
        .filter(m => ids.has(m.convId) && m.role === 'user' && !m.hidden)
        .sort((a, b) => b.id - a.id)
        .slice(0, Math.max(0, limit))
        .map(m => ({ castId: ids.get(m.convId)!, content: m.content, createdAt: m.createdAt }));
      return { casts: others.slice(0, Math.max(0, limit)).map(summary), notes };
    },
  };
}
