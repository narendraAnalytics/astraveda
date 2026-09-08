// Razorpay Standard Checkout inside a WebView. The backend creates the order
// (server-authoritative amount); this only runs checkout.js and reports the
// three fields it returns — the backend verifies them before anything unlocks.
//
// NOTE: Razorpay officially prefers their native SDK; WebView UPI-intent /
// netbanking have known limits. Fine for test-mode cards; swap to the native
// SDK before taking real UPI money (backend stays identical).
import { useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type CheckoutResult =
  | { ok: true; razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
  | { ok: false; reason: 'dismissed' | 'error'; message?: string };

type Props = {
  visible: boolean;
  orderId: string;
  keyId: string;
  amountPaise: number;
  description?: string;
  name?: string;
  email?: string;
  contact?: string;
  onClose: (result: CheckoutResult) => void;
};

function buildHtml(o: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  description: string;
  name: string;
  email: string;
  contact: string;
}): string {
  const j = (v: string) => JSON.stringify(v ?? '');
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
</head><body style="margin:0;background:#fffaf2;font-family:-apple-system,Roboto,Segoe UI,sans-serif">
<div style="padding:28px;text-align:center;color:#6b4f2a;font-size:15px">Opening secure checkout…</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function post(m){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  var opts = {
    key: ${j(o.keyId)},
    order_id: ${j(o.orderId)},
    amount: ${o.amountPaise},
    currency: "INR",
    name: "AstraVeda",
    description: ${j(o.description)},
    prefill: { name: ${j(o.name)}, email: ${j(o.email)}, contact: ${j(o.contact)} },
    theme: { color: "#8f29dd" },
    retry: { enabled: false },
    handler: function (r) {
      post({ ok: true,
        razorpay_payment_id: r.razorpay_payment_id,
        razorpay_order_id: r.razorpay_order_id,
        razorpay_signature: r.razorpay_signature });
    },
    modal: { escape: true, backdropclose: false, ondismiss: function () { post({ ok: false, reason: "dismissed" }); } }
  };
  try {
    var rzp = new Razorpay(opts);
    rzp.on('payment.failed', function (resp) {
      post({ ok: false, reason: "error", message: (resp && resp.error && resp.error.description) || "Payment failed" });
    });
    rzp.open();
  } catch (e) {
    post({ ok: false, reason: "error", message: String(e && e.message || e) });
  }
</script>
</body></html>`;
}

export function RazorpayCheckout({
  visible,
  orderId,
  keyId,
  amountPaise,
  description = 'AstraVeda',
  name = '',
  email = '',
  contact = '',
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const html = useMemo(
    () => buildHtml({ keyId, orderId, amountPaise, description, name, email, contact }),
    [keyId, orderId, amountPaise, description, name, email, contact],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => onClose({ ok: false, reason: 'dismissed' })}
      statusBarTranslucent
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => onClose({ ok: false, reason: 'dismissed' })}
            hitSlop={12}
            style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
          >
            <Feather name="x" size={22} color="#3c2924" />
          </Pressable>
          <Text style={styles.title}>Secure payment</Text>
          <View style={styles.close} />
        </View>
        {visible && orderId ? (
          <WebView
            source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            // 3-D Secure / bank ACS pages need these or they hang mid-auth in a
            // WebView: third-party cookies (Android blocks them by default),
            // shared cookies (iOS), mixed content, and script-opened windows.
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            javaScriptCanOpenWindowsAutomatically
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            cacheEnabled={false}
            incognito={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#8f29dd" />
              </View>
            )}
            onMessage={(e) => {
              try {
                onClose(JSON.parse(e.nativeEvent.data) as CheckoutResult);
              } catch {
                onClose({ ok: false, reason: 'error', message: 'Checkout returned an unexpected response' });
              }
            }}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#8f29dd" />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fffaf2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e7d8c3',
  },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: '#3c2924' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
