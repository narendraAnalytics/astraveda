import { StyleSheet, Text, View } from 'react-native';

const SAFFRON = '#e0932f';

/** "N of C booked · M places left" with a thin progress bar. */
export function CapacityBar({
  booked,
  capacity,
  label = 'today',
}: {
  booked: number;
  capacity: number;
  label?: string;
}) {
  const pct = capacity > 0 ? Math.min(100, (booked / capacity) * 100) : 0;
  const remaining = Math.max(0, capacity - booked);
  const tight = remaining <= Math.max(3, capacity * 0.15);

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tight ? '#d9534f' : SAFFRON }]} />
      </View>
      <Text style={styles.text}>
        <Text style={styles.strong}>{booked}</Text>
        <Text style={styles.dim}> of {capacity} booked {label}</Text>
        {'   ·   '}
        <Text style={[styles.strong, tight && styles.tight]}>{remaining} left</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  track: { height: 5, borderRadius: 3, backgroundColor: '#f0e3d0', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  text: { fontSize: 10.5, color: '#8b6f52' },
  strong: { fontWeight: '800', color: '#6e4a20' },
  dim: { color: '#a2896f' },
  tight: { color: '#c0392b' },
});
