import { Feather } from '@expo/vector-icons';

import { AiReadingView, type ReadingAccent } from '../ai-reading-view';

const PALM_ACCENT: ReadingAccent = {
  from: '#c0356f',
  to: '#c18426',
  cardBg: '#fffdfb',
  cardBorder: '#f2dde4',
  dropCap: '#c0356f',
};

const HEADING_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  'hand nature': 'aperture',
  'heart line & relationships': 'heart',
  'head line & mind': 'zap',
  'life line & vitality': 'activity',
  'fate line & career': 'trending-up',
  'mounts & planetary strengths': 'sun',
  guidance: 'compass',
};

export function PalmReadingView({ text }: { text: string }) {
  return <AiReadingView text={text} accent={PALM_ACCENT} headingIcons={HEADING_ICONS} />;
}
