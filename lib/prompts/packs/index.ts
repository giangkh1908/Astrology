import type { ZiweiChart } from '@/lib/ziwei/types';
import type { InterpretationIntent } from '../shared';
import { LOVE_PACK } from './love';
import { VERIFY_PACK } from './verify';

export { LOVE_PACK, VERIFY_PACK };

/** Gói luật theo chủ đề; chủ đề không có gói thì trả undefined. */
export function topicPackFor(chart: ZiweiChart, intent: InterpretationIntent): string | undefined {
  if (intent.type === 'topic') {
    if (intent.key === 'love') return LOVE_PACK;
    if (intent.key === 'kiem_chung') return VERIFY_PACK;
    return undefined;
  }
  if (intent.type === 'palace' && intent.branch !== undefined) {
    const palace = chart.palaces.find(p => p.branch === intent.branch);
    if (palace?.name === '夫妻') return LOVE_PACK;
  }
  return undefined;
}
