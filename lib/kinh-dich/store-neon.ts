/**
 * KinhDichStore trên Postgres (Neon). Mọi giá trị đi qua tham số của tagged template.
 * Hội thoại kind 'kinhdich', chart_id null, thread_key = castId, meta = {question, lines, castAt}. Schema: db/migrations/004.
 */
import { neon } from '@neondatabase/serverless';
import { buildHistory, UUID_RE } from '@/lib/store/chat-store';
import { recordTurnEndSql } from '@/lib/store/neon-chat-store';
import { getMessageCipher, type MessageCipher } from '@/lib/crypto/message-cipher';
import { parseLines } from './core';
import { ROUTE_NAME, type CastSummary, type KinhDichStore, type Owner } from './store';

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const ownerId = (id: Owner) => (id && UUID_RE.test(id) ? id : null);
const lim = (n: number) => Math.max(0, Math.floor(n));

async function toSummary(r: Row, cipher: MessageCipher): Promise<CastSummary> {
  const meta = (r.meta ?? {}) as Record<string, unknown>;
  return {
    castId: String(r.thread_key),
    question: typeof meta.question === 'string' ? await cipher.open(meta.question) : '',
    lines: parseLines(meta.lines),
    castAt: typeof meta.castAt === 'string' ? meta.castAt : null,
    createdAt: iso(r.created_at),
  };
}

export function createNeonKinhDichStore(databaseUrl: string, cipher: MessageCipher = getMessageCipher()): KinhDichStore {
  const sql = neon(databaseUrl);

  return {
    enabled: true,

    async createCast(owner, question) {
      const castId = crypto.randomUUID();
      const sealed = await cipher.seal(question);
      await sql`
        insert into conversations (kind, chart_id, thread_key, user_id, meta)
        values ('kinhdich', null, ${castId}, ${ownerId(owner)}::uuid, ${JSON.stringify({ question: sealed, lines: null, castAt: null })}::jsonb)`;
      return { castId };
    },

    async getCast(owner, castId) {
      if (!UUID_RE.test(castId)) return null;
      const convs = await sql`
        select id, thread_key, meta, created_at from conversations
        where kind = 'kinhdich' and thread_key = ${castId} and user_id is not distinct from ${ownerId(owner)}::uuid`;
      if (!convs.length) return null;
      const conv = convs[0];
      const rows = await sql`
        select role, content, hidden, request_id, status, created_at from messages
        where conversation_id = ${conv.id}::uuid order by id`;
      const assistants = rows.filter(r => r.role === 'assistant');
      const contents = await Promise.all(rows.map(r => cipher.open(String(r.content))));
      return {
        ...(await toSummary(conv, cipher)),
        messages: buildHistory(rows.map((r, i) => ({
          threadKey: castId, updatedAt: iso(r.created_at), role: r.role as 'user' | 'assistant', content: contents[i],
          hidden: !!r.hidden, requestId: r.request_id ? String(r.request_id) : null,
        })))[0]?.messages ?? [],
        lastAssistantStatus: assistants.length ? ((assistants[assistants.length - 1].status as string | null) ?? null) : null,
        assistantCount: assistants.length,
      };
    },

    async listCasts(owner, limit) {
      const rows = await sql`
        select thread_key, meta, created_at from conversations
        where kind = 'kinhdich' and user_id is not distinct from ${ownerId(owner)}::uuid
        order by created_at desc limit ${lim(limit)}`;
      return Promise.all(rows.map(r => toSummary(r, cipher)));
    },

    async saveLines(owner, castId, lines, castAt) {
      if (!UUID_RE.test(castId) || !parseLines(lines)) return false;
      const at = castAt && !Number.isNaN(Date.parse(castAt)) ? new Date(castAt).toISOString() : new Date().toISOString();
      const rows = await sql`
        update conversations
        set meta = meta || jsonb_build_object('lines', ${JSON.stringify(lines)}::jsonb, 'castAt', ${at}::text), updated_at = now()
        where kind = 'kinhdich' and thread_key = ${castId} and user_id is not distinct from ${ownerId(owner)}::uuid
          and (meta->'lines' is null or jsonb_typeof(meta->'lines') = 'null')
        returning id`;
      return rows.length > 0;
    },

    async recordTurnStart(owner, castId, t) {
      const question = await cipher.seal(t.question);
      const rows = await sql`
        with conv as (
          update conversations set updated_at = now()
          where kind = 'kinhdich' and thread_key = ${castId} and user_id is not distinct from ${ownerId(owner)}::uuid
          returning id
        ), r as (
          insert into ai_requests (conversation_id, route, prompt_version, model, question, status, user_id)
          select conv.id, ${ROUTE_NAME}, ${t.promptVersion}, ${t.model}, ${question}, 'pending', ${ownerId(owner)}::uuid from conv
          returning id, conversation_id
        ), m as (
          insert into messages (conversation_id, role, content, request_id, hidden)
          select conversation_id, 'user', ${question}, id, ${t.hidden} from r
        )
        select id from r`;
      if (!rows.length) throw new Error('Không có lần gieo này');
      return { requestId: String(rows[0].id) };
    },

    async recordTurnEnd(requestId, r) {
      await recordTurnEndSql(sql, requestId, r, cipher);
    },

    async loadMemoryRows(owner, excludeCastId, limit) {
      const owned = ownerId(owner);
      const [casts, notes] = await Promise.all([
        sql`
          select thread_key, meta, created_at from conversations
          where kind = 'kinhdich' and user_id is not distinct from ${owned}::uuid
            and (${excludeCastId}::text is null or thread_key <> ${excludeCastId}::text)
          order by created_at desc limit ${lim(limit)}`,
        sql`
          select v.thread_key, m.content, m.created_at from messages m
          join conversations v on v.id = m.conversation_id
          where v.kind = 'kinhdich' and v.user_id is not distinct from ${owned}::uuid
            and (${excludeCastId}::text is null or v.thread_key <> ${excludeCastId}::text)
            and m.role = 'user' and not m.hidden
          order by m.id desc limit ${lim(limit)}`,
      ]);
      return {
        casts: await Promise.all(casts.map(r => toSummary(r, cipher))),
        notes: await Promise.all(notes.map(async r => ({ castId: String(r.thread_key), content: await cipher.open(String(r.content)), createdAt: iso(r.created_at) }))),
      };
    },
  };
}
