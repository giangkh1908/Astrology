/**
 * ChatStore trên Postgres qua driver HTTP của Neon. Mọi giá trị đi qua tham số của tagged template
 * (không nối chuỗi SQL). Schema: db/migrations/*.sql.
 */
import { neon } from '@neondatabase/serverless';
import {
  PAGE_SIZE, UUID_RE,
  type ChatStore, type ChartSummary, type ConversationDetail, type RequestLog, type StoredMessage, type ToolCallLog, type TurnStatus,
} from './chat-store';

type Row = Record<string, unknown>;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const page = (p: unknown) => (Number.isInteger(p) && (p as number) >= 0 ? (p as number) : 0);

function toSummary(r: Row): ChartSummary {
  return {
    id: String(r.id), key: String(r.chart_key), birthInfo: r.birth_info,
    createdAt: iso(r.created_at), lastActivityAt: iso(r.last_activity_at), conversationCount: Number(r.conversation_count ?? 0),
  };
}

export function createNeonChatStore(databaseUrl: string): ChatStore {
  const sql = neon(databaseUrl);

  return {
    enabled: true,

    async getSetting(key) {
      const rows = await sql`select value from settings where key = ${key}`;
      return rows.length ? String(rows[0].value) : null;
    },

    async setSetting(key, value) {
      await sql`insert into settings (key, value) values (${key}, ${value})
        on conflict (key) do update set value = excluded.value, updated_at = now()`;
    },

    async recordTurnStart(t) {
      // Một câu lệnh (CTE ghi dữ liệu): upsert lá số → upsert hội thoại → tin user → log pending.
      // Hợp bàn với chính lá số đó: không upsert lần hai (Postgres cấm upsert một dòng 2 lần trong 1 câu lệnh).
      const samePartner = t.partnerChart?.key === t.chart.key;
      const partnerKey = t.partnerChart && !samePartner ? t.partnerChart.key : null;
      const partnerInfo = t.partnerChart ? JSON.stringify(t.partnerChart.birthInfo) : null;
      const rows = await sql`
        with c as (
          insert into charts (chart_key, birth_info) values (${t.chart.key}, ${JSON.stringify(t.chart.birthInfo)}::jsonb)
          on conflict (chart_key) do update set last_activity_at = now()
          returning id
        ), p as (
          insert into charts (chart_key, birth_info)
          select ${partnerKey}::text, ${partnerInfo}::jsonb where ${partnerKey}::text is not null
          on conflict (chart_key) do update set last_activity_at = now()
          returning id
        ), conv as (
          insert into conversations (kind, chart_id, partner_chart_id, thread_key)
          select ${t.kind}, c.id, case when ${samePartner} then c.id else (select id from p) end, ${t.threadKey} from c
          on conflict on constraint conversations_identity do update set updated_at = now()
          returning id
        ), r as (
          insert into ai_requests (conversation_id, route, prompt_version, model, question, status)
          select conv.id, ${t.kind}, ${t.promptVersion}, ${t.model}, ${t.question}, 'pending' from conv
          returning id, conversation_id
        ), m as (
          insert into messages (conversation_id, role, content)
          select conversation_id, 'user', ${t.question} from r
        )
        select id from r`;
      return { requestId: String(rows[0].id) };
    },

    async recordTurnEnd(requestId, r) {
      if (!UUID_RE.test(requestId)) return;
      await sql`
        with req as (
          update ai_requests set
            status = ${r.status}, error = ${r.error ?? null},
            first_token_ms = ${r.firstTokenMs ?? null}, duration_ms = ${r.durationMs},
            tool_calls = ${JSON.stringify(r.toolCalls)}::jsonb,
            prompt_tokens = ${r.usage?.promptTokens ?? null}, completion_tokens = ${r.usage?.completionTokens ?? null},
            cost_usd = ${r.usage?.costUsd ?? null}
          where id = ${requestId}::uuid and status = 'pending'
          returning id, conversation_id, prompt_version
        )
        insert into messages (conversation_id, role, content, prompt_version, request_id, status)
        select conversation_id, 'assistant', ${r.text}, prompt_version, id, ${r.status} from req`;
    },

    async listCharts(p) {
      const rows = await sql`
        select c.*, (select count(*) from conversations v where v.chart_id = c.id or v.partner_chart_id = c.id) as conversation_count
        from charts c order by c.last_activity_at desc
        limit ${PAGE_SIZE} offset ${page(p) * PAGE_SIZE}`;
      return rows.map(toSummary);
    },

    async getChart(id) {
      if (!UUID_RE.test(id)) return null;
      const charts = await sql`
        select c.*, (select count(*) from conversations v where v.chart_id = c.id or v.partner_chart_id = c.id) as conversation_count
        from charts c where c.id = ${id}::uuid`;
      if (!charts.length) return null;
      const convs = await sql`
        select v.id, v.kind, v.thread_key, v.chart_id, v.partner_chart_id,
               o.id as other_id, o.birth_info as other_birth_info
        from conversations v
        left join charts o on o.id = case when v.chart_id = ${id}::uuid then v.partner_chart_id else v.chart_id end
        where v.chart_id = ${id}::uuid or v.partner_chart_id = ${id}::uuid
        order by v.updated_at desc`;
      const ids = convs.map(v => String(v.id));
      const msgs = ids.length ? await sql`
        select id, conversation_id, role, content, prompt_version, status, created_at
        from messages where conversation_id = any(${ids}::uuid[]) order by id` : [];
      const conversations: ConversationDetail[] = convs.map(v => ({
        id: String(v.id),
        kind: v.kind as ConversationDetail['kind'],
        threadKey: String(v.thread_key),
        ...(v.other_id ? { partner: { id: String(v.other_id), birthInfo: v.other_birth_info } } : {}),
        messages: msgs.filter(m => String(m.conversation_id) === String(v.id)).map((m): StoredMessage => ({
          id: String(m.id), role: m.role as StoredMessage['role'], content: String(m.content),
          promptVersion: (m.prompt_version as string | null) ?? null, status: (m.status as string | null) ?? null, createdAt: iso(m.created_at),
        })),
      }));
      return { chart: toSummary(charts[0]), conversations };
    },

    async listRequests(f) {
      const from = f.from && DATE_RE.test(f.from) ? f.from : null;
      const to = f.to && DATE_RE.test(f.to) ? f.to : null;
      const rows = await sql`
        select r.*, v.chart_id,
               (select content from messages m where m.request_id = r.id and m.role = 'assistant' order by m.id desc limit 1) as answer
        from ai_requests r left join conversations v on v.id = r.conversation_id
        where (${f.route ?? null}::text is null or r.route = ${f.route ?? null})
          and (${f.promptVersion ?? null}::text is null or r.prompt_version = ${f.promptVersion ?? null})
          and (${f.status ?? null}::text is null or r.status = ${f.status ?? null})
          and (${from}::date is null or (r.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= ${from}::date)
          and (${to}::date is null or (r.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= ${to}::date)
        order by r.created_at desc
        limit ${PAGE_SIZE} offset ${page(f.page) * PAGE_SIZE}`;
      return rows.map((r): RequestLog => ({
        id: String(r.id), createdAt: iso(r.created_at), route: String(r.route), promptVersion: String(r.prompt_version),
        model: String(r.model), status: r.status as TurnStatus, question: (r.question as string | null) ?? null,
        answer: (r.answer as string | null) ?? null, error: (r.error as string | null) ?? null,
        firstTokenMs: numOrNull(r.first_token_ms), durationMs: numOrNull(r.duration_ms),
        toolCalls: Array.isArray(r.tool_calls) ? (r.tool_calls as ToolCallLog[]) : [],
        promptTokens: numOrNull(r.prompt_tokens), completionTokens: numOrNull(r.completion_tokens), costUsd: numOrNull(r.cost_usd),
        chartId: r.chart_id ? String(r.chart_id) : null,
      }));
    },

    async versionUsage() {
      const rows = await sql`select prompt_version, count(*) as count, max(created_at) as last_used_at from ai_requests group by prompt_version`;
      return rows.map(r => ({ promptVersion: String(r.prompt_version), count: Number(r.count), lastUsedAt: r.last_used_at ? iso(r.last_used_at) : null }));
    },
  };
}
