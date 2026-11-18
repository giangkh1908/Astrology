import { PROMPT_VERSIONS } from '@/lib/prompts';
import { getChatStore } from '@/lib/store';
import { resolvePromptVersion, type VersionUsage } from '@/lib/store/chat-store';
import { formatDateTime } from '@/app/admin/format';
import { requireAdminPage } from '@/app/admin/guard';
import { PromptPicker } from './PromptPicker';
import { KINH_DICH_VERSIONS, resolveKinhDichVersion } from '@/lib/kinh-dich/versions';
import { DbDisabled } from '@/app/admin/ui';
import s from '@/app/admin/admin.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminPromptPage() {
  await requireAdminPage('/admin');
  const store = getChatStore();
  const active = await resolvePromptVersion(store);
  const activeKd = await resolveKinhDichVersion(store);
  let usage: VersionUsage[] = [];
  let usageError = false;
  if (store.enabled) {
    try { usage = await store.versionUsage(); } catch (error) {
      usageError = true;
      console.error('versionUsage failed:', error instanceof Error ? error.message : 'unknown error');
    }
  }

  return (
    <div className={s.stack}>
      {!store.enabled && <DbDisabled />}
      <p className={s.muted}>Chọn version prompt cho mọi câu hỏi AI mới. Đổi có hiệu lực ngay, không cần deploy lại.</p>
      {usageError && <p className={s.error}>Không đọc được thống kê lượt dùng.</p>}
      <div className={s.grid}>
        {PROMPT_VERSIONS.map(v => {
          const u = usage.find(x => x.promptVersion === v.id);
          const isActive = v.id === active;
          return (
            <section key={v.id} className={isActive ? s.cardActive : s.card}>
              <h2 className={s.h2}>{v.label}</h2>
              <p className={s.muted}>{v.description}</p>
              <p className={s.small}>
                {u ? `${u.count} lượt · lần cuối ${formatDateTime(u.lastUsedAt)}` : 'Chưa có lượt nào'}
              </p>
              <div style={{ marginTop: 10 }}>
                <PromptPicker version={v.id} active={isActive} disabled={!store.enabled} />
              </div>
            </section>
          );
        })}
      </div>
      <h2 className={s.h2}>Kinh Dịch</h2>
      <p className={s.muted}>Version prompt cho các lần gieo Kinh Dịch mới (riêng với version Tử Vi ở trên).</p>
      <div className={s.grid}>
        {KINH_DICH_VERSIONS.map(v => {
          // Lượt dùng gộp cả bước làm rõ câu hỏi (kd1-prepare / kd2-prepare).
          const rows = usage.filter(x => x.promptVersion === v.id || x.promptVersion === `${v.id}-prepare`);
          const count = rows.reduce((n, x) => n + x.count, 0);
          const last = rows.map(x => x.lastUsedAt).filter((x): x is string => !!x).sort().at(-1) ?? null;
          const isActive = v.id === activeKd;
          return (
            <section key={v.id} className={isActive ? s.cardActive : s.card}>
              <h2 className={s.h2}>{v.label}</h2>
              <p className={s.muted}>{v.description}</p>
              <p className={s.small}>
                {count ? `${count} lượt · lần cuối ${formatDateTime(last)}` : 'Chưa có lượt nào'}
              </p>
              <div style={{ marginTop: 10 }}>
                <PromptPicker version={v.id} active={isActive} disabled={!store.enabled} endpoint="/api/admin/kinh-dich-version" />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
