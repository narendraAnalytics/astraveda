import { StyleSheet, Text, View } from 'react-native';

import { ELEMENT_HEX, ELEMENT_STATE_RANK, type VastuElement } from '../../lib/vastu';

const STATE_LABEL: Record<string, string> = {
  strong: 'Strong',
  balanced: 'Balanced',
  weak: 'Weak',
  afflicted: 'Afflicted',
};

export function ElementBars({ elements }: { elements: VastuElement[] }) {
  return (
    <View style={styles.wrap}>
      {elements.map((e) => {
        const hex = ELEMENT_HEX[e.element] ?? '#a2896f';
        const pct = (ELEMENT_STATE_RANK[e.state] ?? 0.5) * 100;
        return (
          <View key={e.element} style={styles.row}>
            <View style={styles.head}>
              <View style={[styles.dot, { backgroundColor: hex }]} />
              <Text style={styles.name}>{e.element}</Text>
              <Text style={styles.state}>{STATE_LABEL[e.state] ?? e.state}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: hex }]} />
            </View>
            {e.note ? <Text style={styles.note}>{e.note}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  row: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  name: { flex: 1, fontSize: 13, fontWeight: '800', color: '#4a3626' },
  state: { fontSize: 11, fontWeight: '700', color: '#9a806a' },
  track: { height: 7, borderRadius: 4, backgroundColor: '#f0e6d8', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  note: { fontSize: 12, lineHeight: 17, color: '#6e5747', marginTop: 1 },
});
