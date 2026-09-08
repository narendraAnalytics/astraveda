import { StyleSheet, Text, View } from 'react-native';

import { CHAKRAS } from '../../lib/aura';

/**
 * The seven chakras, root → crown. State is parsed loosely from the Sarvam
 * reading text (open / tender / over-active) — decorative, the words in the
 * reading are the source of truth.
 */
type State = 'open' | 'tender' | 'active' | 'neutral';

const STATE_LABEL: Record<State, string> = {
  open: 'Open',
  tender: 'Tender',
  active: 'Over-active',
  neutral: '—',
};

export function chakraStatesFromReading(text: string): Record<string, State> {
  const out: Record<string, State> = {};
  const lower = text.toLowerCase();
  for (const ch of CHAKRAS) {
    const name = ch.label.toLowerCase();
    const idx = lower.indexOf(name);
    if (idx === -1) {
      out[ch.key] = 'neutral';
      continue;
    }
    const window = lower.slice(idx, idx + 90);
    if (/over-?active|overactive|excess|too much|racing/.test(window)) out[ch.key] = 'active';
    else if (/tender|blocked|closed|guarded|weak|quiet|dim|needs/.test(window)) out[ch.key] = 'tender';
    else if (/open|balanced|strong|bright|flowing|clear/.test(window)) out[ch.key] = 'open';
    else out[ch.key] = 'neutral';
  }
  return out;
}

export function ChakraColumn({ states }: { states: Record<string, State> }) {
  return (
    <View style={styles.wrap}>
      {[...CHAKRAS].reverse().map((ch) => {
        const st = states[ch.key] ?? 'neutral';
        return (
          <View key={ch.key} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: ch.hex, opacity: st === 'neutral' ? 0.35 : 1 }]} />
            <Text style={styles.name}>{ch.label}</Text>
            <View style={[styles.pill, st === 'neutral' && styles.pillNeutral]}>
              <Text style={[styles.pillText, st === 'neutral' && styles.pillTextNeutral]}>{STATE_LABEL[st]}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  name: { flex: 1, fontSize: 13, fontWeight: '700', color: '#3a2f4a' },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#efe9fe' },
  pillNeutral: { backgroundColor: '#f0eef4' },
  pillText: { fontSize: 10, fontWeight: '800', color: '#7c3aed', letterSpacing: 0.2 },
  pillTextNeutral: { color: '#9a92a8' },
});
