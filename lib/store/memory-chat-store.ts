import { randomUUID } from 'node:crypto';
import {
  PAGE_SIZE, type ChatStore, type ChartSummary, type ConversationDetail, type RequestLog, type StoredMessage, type TurnStatus,
} from './chat-store';

/** ChatStore trong bộ nhớ, cho test. Hành vi phải khớp neon-chat-store (cùng bộ test hợp đồng). */
export function createMemoryChatStore(): ChatStore {
  const settings = new Map<string, string>();
  const charts: { id: string; key: string; birthInfo: unknown; createdAt: string; lastActivityAt: string }[] = [];
  const convs: { id: string; kind: 'interpret' | 'heming'; chartId: string; partnerId: string | null; threadKey: string }[] = [];
  const messages: (StoredMessage & { conversationId: string; requestId: string | null })[] = [];
  const requests: (Omit<RequestLog, 'answer' | 'chartId'> & { conversationId: string })[] = [];
  let seq = 0;
  const now = () => new Date(Date.now() + seq++).toISOString(); // tăng dần để thứ tự ổn định

  const upsertChart = (key: string, birthInfo: unknown) => {
    let c = charts.find(x => x.key === key);
    if (!c) { c = { id: randomUUID(), key, birthInfo, createdAt: now(), lastActivityAt: now() }; charts.push(c); }
    else c.lastActivityAt = now();
    return c.id;
  };
  const summary = (c: typeof charts[number]): ChartSummary => ({
    ...c, conversationCount: convs.filter(v => v.chartId === c.id || v.partnerId === c.id).length,
  });

  return {
    enabled: true,
    async getSetting(key) { return settings.get(key) ?? null; },
    async setSetting(key, value) { settings.set(key, value); },
    async recordTurnStart(t) {
      const chartId = upsertChart(t.chart.key, t.chart.birthInfo);
      const partnerId = t.partnerChart ? upsertChart(t.partnerChart.key, t.partnerChart.birthInfo) : null;
      let conv = convs.find(v => v.kind === t.kind && v.chartId === chartId && v.partnerId === partnerId && v.threadKey === t.threadKey);
      if (!conv) { conv = { id: randomUUID(), kind: t.kind, chartId, partnerId, threadKey: t.threadKey }; convs.push(conv); }
      const requestId = randomUUID();
      messages.push({ id: String(messages.length + 1), conversationId: conv.id, requestId: null, role: 'user', content: t.question, promptVersion: null, status: null, createdAt: now() });
      requests.push({
        id: requestId, conversationId: conv.id, createdAt: now(), route: t.kind, promptVersion: t.promptVersion, model: t.model,
        status: 'pending', question: t.question, error: null, firstTokenMs: null, durationMs: null, toolCalls: [],
        promptTokens: null, completionTokens: null, costUsd: null,
      });
      return { requestId };
    },
    async recordTurnEnd(requestId, r) {
      const req = requests.find(x => x.id === requestId);
      if (!req) return;
      messages.push({ id: String(messages.length + 1), conversationId: req.conversationId, requestId, role: 'assistant', content: r.text, promptVersion: req.promptVersion, status: r.status, createdAt: now() });
      Object.assign(req, {
        status: r.status as TurnStatus, error: r.error ?? null, firstTokenMs: r.firstTokenMs ?? null, durationMs: r.durationMs,
        toolCalls: r.toolCalls, promptTokens: r.usage?.promptTokens ?? null, completionTokens: r.usage?.completionTokens ?? null, costUsd: r.usage?.costUsd ?? null,
      });
    },
    async listCharts(page) {
      return [...charts].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(summary);
    },
    async getChart(id) {
      const c = charts.find(x => x.id === id);
      if (!c) return null;
      const conversations: ConversationDetail[] = convs.filter(v => v.chartId === id || v.partnerId === id).map(v => {
        const otherId = v.chartId === id ? v.partnerId : v.chartId;
        const other = otherId ? charts.find(x => x.id === otherId) : undefined;
        return {
          id: v.id, kind: v.kind, threadKey: v.threadKey,
          ...(other ? { partner: { id: other.id, birthInfo: other.birthInfo } } : {}),
          messages: messages.filter(m => m.conversationId === v.id).map(({ conversationId: _c, requestId: _r, ...m }) => m),
        };
      });
      return { chart: summary(c), conversations };
    },
    async listRequests(f) {
      return requests
        .filter(r => (!f.route || r.route === f.route) && (!f.promptVersion || r.promptVersion === f.promptVersion) && (!f.status || r.status === f.status))
        .filter(r => (!f.from || r.createdAt.slice(0, 10) >= f.from) && (!f.to || r.createdAt.slice(0, 10) <= f.to))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice((f.page ?? 0) * PAGE_SIZE, ((f.page ?? 0) + 1) * PAGE_SIZE)
        .map(({ conversationId, ...r }) => ({
          ...r,
          answer: messages.find(m => m.requestId === r.id)?.content ?? null,
          chartId: convs.find(v => v.id === conversationId)?.chartId ?? null,
        }));
    },
    async versionUsage() {
      const map = new Map<string, { count: number; lastUsedAt: string | null }>();
      for (const r of requests) {
        const u = map.get(r.promptVersion) ?? { count: 0, lastUsedAt: null };
        u.count++; if (!u.lastUsedAt || r.createdAt > u.lastUsedAt) u.lastUsedAt = r.createdAt;
        map.set(r.promptVersion, u);
      }
      return [...map].map(([promptVersion, u]) => ({ promptVersion, ...u }));
    },
  };
}
