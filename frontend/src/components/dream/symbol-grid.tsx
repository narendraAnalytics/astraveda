import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { DreamSymbol } from '../../lib/dream';

// A small glyph per common dream symbol keyword — falls back to a star.
const GLYPH: { test: RegExp; glyph: string }[] = [
  { test: /water|ocean|sea|river|flood|rain|wave/i, glyph: '🌊' },
  { test: /fire|flame|burn|smoke/i, glyph: '🔥' },
  { test: /fly|flight|wing|bird|sky/i, glyph: '🕊️' },
  { test: /fall|falling|cliff|edge/i, glyph: '🪂' },
  { test: /snake|serpent|naga/i, glyph: '🐍' },
  { test: /door|gate|key|threshold/i, glyph: '🚪' },
  { test: /stair|ladder|climb|steps/i, glyph: '🪜' },
  { test: /house|home|room|building/i, glyph: '🏠' },
  { test: /death|grave|funeral|corpse/i, glyph: '🕯️' },
  { test: /baby|child|birth/i, glyph: '👶' },
  { test: /car|road|drive|journey|train/i, glyph: '🛣️' },
  { test: /teeth|tooth/i, glyph: '🦷' },
  { test: /money|gold|coin|wealth/i, glyph: '🪙' },
  { test: /light|sun|dawn|lamp/i, glyph: '☀️' },
  { test: /moon|night|dark/i, glyph: '🌙' },
  { test: /mirror|reflection|face/i, glyph: '🪞' },
  { test: /forest|tree|wood|garden/i, glyph: '🌳' },
  { test: /chase|run|escape|pursued/i, glyph: '🏃' },
  { test: /storm|wind|thunder/i, glyph: '⛈️' },
  { test: /mountain|hill|peak/i, glyph: '⛰️' },
];

function glyphFor(symbol: string): string {
  return GLYPH.find((g) => g.test.test(symbol))?.glyph ?? '✦';
}

export function SymbolGrid({ symbols }: { symbols: DreamSymbol[] }) {
  return (
    <View style={styles.wrap}>
      {symbols.map((s, i) => (
        <View key={`${s.symbol}-${i}`} style={styles.card}>
          <LinearGradient
            colors={['#4f46e5', '#6d28d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glyphChip}
          >
            <Text style={styles.glyph}>{glyphFor(s.symbol)}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.symbol}>{s.symbol}</Text>
            {s.meaning ? <Text style={styles.meaning}>{s.meaning}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fbfbff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7e6f6',
    padding: 13,
  },
  glyphChip: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 18 },
  symbol: { fontSize: 14, fontWeight: '800', color: '#2b2a45', letterSpacing: 0.2 },
  meaning: { fontSize: 13, lineHeight: 19, color: '#575572', marginTop: 3 },
});
