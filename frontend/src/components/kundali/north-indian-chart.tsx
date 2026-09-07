import { StyleSheet, View } from 'react-native';
import Svg, { Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import type { House } from '../../lib/kundali';

const ABBR: Record<string, string> = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju',
  Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

// Classic North-Indian layout: house 1 is the top-centre diamond, houses run
// anticlockwise. Anchor points are fractions of the square.
const ANCHORS: [number, number][] = [
  [0.5, 0.24], [0.25, 0.12], [0.12, 0.25], [0.25, 0.5], [0.12, 0.75], [0.25, 0.88],
  [0.5, 0.76], [0.75, 0.88], [0.88, 0.75], [0.75, 0.5], [0.88, 0.25], [0.75, 0.12],
];

export function NorthIndianChart({ houses, size = 300 }: { houses: House[]; size?: number }) {
  const s = size;
  const m = (v: number) => v * s;

  return (
    <View style={[styles.wrap, { width: s, height: s }]}>
      <Svg width={s} height={s}>
        <Rect x={1} y={1} width={s - 2} height={s - 2} fill="#fffdf8" stroke="#c9a25f" strokeWidth={1.5} />
        <Line x1={1} y1={1} x2={s - 1} y2={s - 1} stroke="#d8b878" strokeWidth={1} />
        <Line x1={s - 1} y1={1} x2={1} y2={s - 1} stroke="#d8b878" strokeWidth={1} />
        <Polygon
          points={`${m(0.5)},1 ${s - 1},${m(0.5)} ${m(0.5)},${s - 1} 1,${m(0.5)}`}
          fill="none"
          stroke="#d8b878"
          strokeWidth={1}
        />
        {houses.map((h, i) => {
          const [fx, fy] = ANCHORS[i];
          const planets = h.planets.map((p) => ABBR[p] ?? p.slice(0, 2));
          return (
            <SvgText key={h.house} x={m(fx)} y={m(fy)} textAnchor="middle">
              <SvgText fill="#b08a4c" fontSize={9}>{h.sign_index + 1}</SvgText>
              {planets.map((p, j) => (
                <SvgText key={p + j} x={m(fx)} dy={12} fill="#4a2f20" fontSize={11} fontWeight="700">
                  {p}
                </SvgText>
              ))}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
});
