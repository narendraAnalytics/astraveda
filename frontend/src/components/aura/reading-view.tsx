import { Feather } from '@expo/vector-icons';

import { AiReadingView, type ReadingAccent } from '../ai-reading-view';

const AURA_ACCENT: ReadingAccent = {
  from: '#7c3aed',
  to: '#c026d3',
  cardBg: '#fdfbff',
  cardBorder: '#ece4f7',
  dropCap: '#7c3aed',
};

const HEADING_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  'your aura colour': 'sun',
  'your aura color': 'sun',
  'the secondary tones': 'droplet',
  'the seven chakras': 'align-center',
  'your gifts': 'gift',
  'the shadow side': 'moon',
  "this week's energy": 'trending-up',
  guidance: 'compass',
};

export function AuraReadingView({ text }: { text: string }) {
  return <AiReadingView text={text} accent={AURA_ACCENT} headingIcons={HEADING_ICONS} />;
}
