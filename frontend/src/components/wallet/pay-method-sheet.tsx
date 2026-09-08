import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { rupees } from '../../lib/wallet';

/**
 * The "pay by wallet or card" chooser shown before every tool checkout.
 * The wallet row is disabled (with an "Add money" shortcut) when the balance
 * is short.
 */
export function PayMethodSheet({
  visible,
  amountPaise,
  balancePaise,
  onPick,
  onAddMoney,
  onClose,
}: {
  visible: boolean;
  amountPaise: number;
  balancePaise: number;
  onPick: (method: 'wallet' | 'card') => void;
  onAddMoney: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const enough = balancePaise >= amountPaise;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Pay {rupees(amountPaise)}</Text>

        <Pressable
          disabled={!enough}
          onPress={() => onPick('wallet')}
          style={({ pressed }) => [styles.row, !enough && styles.rowOff, pressed && enough && styles.pressed]}
        >
          <View style={[styles.icon, { backgroundColor: '#fdf1dd' }]}>
            <Feather name="credit-card" size={18} color="#c18426" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>AstraVeda Wallet</Text>
            <Text style={[styles.rowSub, !enough && styles.rowSubWarn]}>
              Balance {rupees(balancePaise)}
              {!enough ? ' · not enough' : ''}
            </Text>
          </View>
          {enough ? (
            <Feather name="chevron-right" size={18} color="#c7ad97" />
          ) : (
            <Pressable onPress={onAddMoney} hitSlop={8} style={styles.addBtn}>
              <Text style={styles.addBtnText}>Add money</Text>
            </Pressable>
          )}
        </Pressable>

        <Pressable onPress={() => onPick('card')} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={[styles.icon, { backgroundColor: '#f3e8ff' }]}>
            <Feather name="smartphone" size={18} color="#8f29dd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Card / UPI</Text>
            <Text style={styles.rowSub}>Pay securely via Razorpay</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#c7ad97" />
        </Pressable>

        <Pressable onPress={onClose} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fffaf2',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#e2d3bf', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '800', color: '#4a2f20', marginBottom: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eeddc8',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  rowOff: { opacity: 0.75 },
  pressed: { opacity: 0.7 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '800', color: '#4a2f20' },
  rowSub: { fontSize: 11.5, color: '#8b6f62', marginTop: 2 },
  rowSubWarn: { color: '#c0392b', fontWeight: '600' },
  addBtn: { backgroundColor: '#c18426', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  cancelText: { fontSize: 13, fontWeight: '700', color: '#8b6f62' },
});
