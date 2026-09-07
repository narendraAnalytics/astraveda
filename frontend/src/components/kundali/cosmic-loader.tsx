import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

const STEPS = [
  'Casting the Lagna…',
  'Placing the nine grahas…',
  'Reading the Moon’s nakshatra…',
  'Unrolling the Vimshottari Dasha…',
  'Composing your reading…',
];

export function CosmicLoader({ size = 220 }: { size?: number }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [step, setStep] = useState(0);
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1);
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(pulse);
    };
  }, [reduceMotion, spin, pulse]);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2100);
    return () => clearInterval(id);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    opacity: 0.75 + pulse.value * 0.25,
  }));

  const r = size / 2;
  const glyphR = r - 18;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
          <Svg width={size} height={size}>
            <Circle cx={r} cy={r} r={r - 6} stroke="#e7cfa6" strokeWidth={1.5} fill="none" />
            <Circle cx={r} cy={r} r={r - 34} stroke="#efe0c6" strokeWidth={1} fill="none" />
            <G>
              {SIGN_GLYPHS.map((g, i) => {
                const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
                const x = r + glyphR * Math.cos(a);
                const y = r + glyphR * Math.sin(a);
                return (
                  <G key={g}>
                    <Line
                      x1={r + (r - 34) * Math.cos(a)}
                      y1={r + (r - 34) * Math.sin(a)}
                      x2={r + (r - 6) * Math.cos(a)}
                      y2={r + (r - 6) * Math.sin(a)}
                      stroke="#ecdcbf"
                      strokeWidth={1}
                    />
                    <SvgText x={x} y={y + 5} fontSize={15} fill="#b6852f" textAnchor="middle">
                      {g}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.core, coreStyle]}>
          <Text style={styles.om}>ॐ</Text>
        </Animated.View>
      </View>

      <View style={styles.statusWrap}>
        <Animated.Text key={step} entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)} style={styles.status}>
          {STEPS[step]}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  core: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#8f29dd',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a72be6',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  om: { fontSize: 38, color: '#fff6ff', lineHeight: 44 },
  statusWrap: { height: 26, marginTop: 22, justifyContent: 'center' },
  status: { fontSize: 13, fontWeight: '600', color: '#7a5a3f', letterSpacing: 0.3 },
});
