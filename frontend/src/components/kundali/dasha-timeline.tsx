import { StyleSheet, Text, View } from 'react-native';

import type { DashaPeriod } from '../../lib/kundali';

const LORD_TINT: Record<string, string> = {
  Ketu: '#8a8f98', Venus: '#d96a9c', Sun: '#e0912f', Moon: '#5b9bd5', Mars: '#d4553f',
  Rahu: '#6b6f8a', Jupiter: '#d1a63a', Saturn: '#4f5b6b', Mercury: '#4faa6a',
};

const year = (iso: string) => iso.slice(0, 4);

export function DashaTimeline({
  periods,
  currentLord,
  title,
}: {
  periods: DashaPeriod[];
  currentLord: string | null;
  title: string;
}) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.track}>
        {periods.map((p) => {
          const active = p.lord === currentLord;
          const tint = LORD_TINT[p.lord] ?? '#9a671a';
          return (
            <View key={p.start} style={[styles.seg, active && styles.segActive]}>
              <View style={[styles.dot, { backgroundColor: tint }]} />
              <Text style={[styles.lord, active && styles.lordActive]} numberOfLines={1}>
                {p.lord}
              </Text>
              <Text style={styles.span}>
                {year(p.start)}–{year(p.end)}
              </Text>
              {active ? <Text style={styles.now}>now</Text> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 12, fontWeight: '700', color: '#5e3e31', marginBottom: 10 },
  track: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  seg: {
    minWidth: 82,
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ecdcc2',
    backgroundColor: '#fffdf7',
    paddingVertical: 8,
    paddingHorizontal: 9,
  },
  segActive: { borderColor: '#8f29dd', backgroundColor: '#f6edff' },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 5 },
  lord: { fontSize: 12, fontWeight: '600', color: '#4a2f20' },
  lordActive: { color: '#8f29dd' },
  span: { fontSize: 9, color: '#9b7663', marginTop: 1 },
  now: { fontSize: 8, fontWeight: '800', color: '#8f29dd', marginTop: 3, letterSpacing: 0.5 },
});
