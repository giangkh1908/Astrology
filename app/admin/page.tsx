import { PROMPT_VERSIONS } from '@/lib/prompts';
import { getChatStore } from '@/lib/store';
import { resolvePromptVersion, type VersionUsage } from '@/lib/store/chat-store';
import { formatDateTime } from './format';
import { requireAdminPage } from './guard';
import { PromptPicker } from './PromptPicker';
import { DbDisabled } from './ui';
import s from './admin.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminPromptPage() {
  await requireAdminPage('/admin');
  const store = getChatStore();
  const active = await resolvePromptVersion(store);
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
    </div>
  );
}
