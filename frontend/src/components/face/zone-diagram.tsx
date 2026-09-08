import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, ClipPath, Line, Rect, G } from 'react-native-svg';

// The three Trikala zones of Mukha Samudrika: upper (forehead → brow) = early
// life & intellect, middle (brow → nose tip) = middle life & drive, lower
// (nose tip → chin) = later life & willpower.
const ZONES = [
  { key: 'upper', label: 'Upper · early life', color: '#0f8a7e' },
  { key: 'middle', label: 'Middle · middle life', color: '#3fa66b' },
  { key: 'lower', label: 'Lower · later life', color: '#c18426' },
];

export function ZoneDiagram({ size = 200 }: { size?: number }) {
  const w = size;
  const h = size * 1.15;
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.36;
  const ry = h * 0.44;
  const y1 = cy - ry + (2 * ry) / 3;
  const y2 = cy - ry + (4 * ry) / 3;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={w} height={h}>
        <Defs>
          <ClipPath id="faceClip">
            <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#faceClip)">
          <Rect x={0} y={0} width={w} height={y1} fill={`${ZONES[0].color}22`} />
          <Rect x={0} y={y1} width={w} height={y2 - y1} fill={`${ZONES[1].color}22`} />
          <Rect x={0} y={y2} width={w} height={h - y2} fill={`${ZONES[2].color}22`} />
        </G>
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke="#8a6f5f" strokeWidth={1.5} fill="none" />
        <Line x1={cx - rx} y1={y1} x2={cx + rx} y2={y1} stroke="#8a6f5f" strokeWidth={1} strokeDasharray="3 4" />
        <Line x1={cx - rx} y1={y2} x2={cx + rx} y2={y2} stroke="#8a6f5f" strokeWidth={1} strokeDasharray="3 4" />
      </Svg>
      <View style={styles.legend}>
        {ZONES.map((z) => (
          <View key={z.key} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: z.color }]} />
            <Text style={styles.legendText}>{z.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { marginTop: 12, gap: 6, alignSelf: 'stretch' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#6e5647', fontWeight: '600' },
});
