import { Feather } from '@expo/vector-icons';

import { AiReadingView, type ReadingAccent } from '../ai-reading-view';

const FACE_ACCENT: ReadingAccent = {
  from: '#0f8a7e',
  to: '#3fa66b',
  cardBg: '#fbfdfc',
  cardBorder: '#dcece6',
  dropCap: '#0f8a7e',
};

const HEADING_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  'face nature': 'user',
  'forehead & early life': 'sunrise',
  'eyes & eyebrows': 'eye',
  'nose & prosperity': 'trending-up',
  'lips & speech': 'message-circle',
  'chin, jaw & willpower': 'shield',
  'the three zones (trikala)': 'layers',
  guidance: 'compass',
};

export function FaceReadingView({ text }: { text: string }) {
  return <AiReadingView text={text} accent={FACE_ACCENT} headingIcons={HEADING_ICONS} />;
}
