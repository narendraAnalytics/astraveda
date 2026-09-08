import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

import { rupees, type PujaOrder } from '../../lib/puja';

const MAROON = '#7a1f2b';

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

/** The temple e-pass — shown at the temple, or exported to PDF. */
export function BookingSlip({ order }: { order: PujaOrder }) {
  return (
    <View style={styles.card}>
      <LinearGradient colors={['#7a1f2b', '#a83a2b', '#e0932f']} style={styles.top}>
        <View style={styles.omRow}>
          <Text style={styles.om}>ॐ</Text>
          <Text style={styles.brand}>AstraVeda · Puja Booking</Text>
        </View>
        <Text style={styles.temple}>{order.temple_name}</Text>
        <Text style={styles.deity}>{order.deity} · {order.temple_city}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.qrWrap}>
          <QRCode value={order.booking_code || order.id} size={132} backgroundColor="#fff" color="#2b1a1d" />
          <Text style={styles.code}>{order.booking_code}</Text>
          <Text style={styles.codeHint}>Show this at the temple counter</Text>
        </View>

        <View style={styles.rows}>
          <Row label="Puja / Seva" value={order.puja_name} />
          <Row label="Date" value={prettyDate(order.preferred_date)} />
          <Row label="Devotee" value={order.devotee_name} />
          {order.gotra ? <Row label="Gotra" value={order.gotra} /> : null}
          {order.nakshatra ? <Row label="Nakshatra" value={order.nakshatra} /> : null}
          <Row label="Devotees" value={String(order.num_devotees)} />
          <Row label="Amount paid" value={rupees(order.amount_paise)} />
        </View>

        <View style={styles.statusRow}>
          <Feather name="check-circle" size={13} color="#2f8f5b" />
          <Text style={styles.statusText}>Confirmed{order.confirmed_at ? ` · ${prettyDate(order.confirmed_at.slice(0, 10))}` : ''}</Text>
        </View>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e6c9b3',
    backgroundColor: '#fff',
  },
  top: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 },
  omRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  om: { fontSize: 18, color: '#ffe9c9' },
  brand: { fontSize: 10.5, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6 },
  temple: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 12 },
  deity: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 3 },

  body: { padding: 18 },
  qrWrap: { alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0e3d0' },
  code: { fontSize: 20, fontWeight: '900', color: MAROON, letterSpacing: 2, marginTop: 12 },
  codeHint: { fontSize: 11, color: '#9a806a', marginTop: 3 },

  rows: { marginTop: 14, gap: 9 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  rowLabel: { fontSize: 12, color: '#9a806a', fontWeight: '600' },
  rowValue: { fontSize: 13, color: '#3c2b25', fontWeight: '700', flexShrink: 1, textAlign: 'right' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  statusText: { fontSize: 11.5, fontWeight: '700', color: '#2f8f5b' },
});
