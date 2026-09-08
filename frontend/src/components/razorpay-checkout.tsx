// Razorpay Standard Checkout inside a WebView. The backend creates the order
// (server-authoritative amount); this only runs checkout.js and reports the
// three fields it returns — the backend verifies them before anything unlocks.
//
// NOTE: Razorpay officially prefers their native SDK; WebView UPI-intent /
// netbanking + 3-D Secure have known limits. Fine for test-mode cards; swap to
// the native SDK before taking real UPI money (backend stays identical).
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

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0 })}`;

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
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
<style>
  html,body{margin:0;height:100%;background:#fffaf2;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    -webkit-tap-highlight-color:transparent}
  .wrap{min-height:100%;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:14px;padding:32px 24px calc(32px + env(safe-area-inset-bottom));
    text-align:center;color:#6b4f2a}
  .ring{width:34px;height:34px;border-radius:50%;border:3px solid #ecd9bd;
    border-top-color:#8f29dd;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .t{font-size:15px;font-weight:600;color:#4a2f20}
  .s{font-size:12.5px;color:#9b7663;line-height:1.5}
</style>
</head><body>
<div class="wrap">
  <div class="ring"></div>
  <div class="t">Opening secure checkout…</div>
  <div class="s">Powered by Razorpay. If the payment window does not appear, tap Retry.</div>
</div>
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
    theme: { color: "#8f29dd", backdrop_color: "#fffaf2" },
    retry: { enabled: false },
    handler: function (r) {
      post({ ok: true,
        razorpay_payment_id: r.razorpay_payment_id,
        razorpay_order_id: r.razorpay_order_id,
        razorpay_signature: r.razorpay_signature });
    },
    modal: { escape: true, backdropclose: false, animation: true,
      ondismiss: function () { post({ ok: false, reason: "dismissed" }); } }
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
      navigationBarTranslucent
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
          <View style={styles.titleWrap}>
            <Feather name="lock" size={12} color="#6b4f2a" />
            <Text style={styles.title}>Secure payment</Text>
          </View>
          <Text style={styles.amount}>{rupees(amountPaise)}</Text>
        </View>

        {/* pad the WebView above the Android system nav bar so checkout's
            buttons are never hidden behind it */}
        <View style={[styles.webWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e7d8c3',
    backgroundColor: '#fffaf2',
  },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '700', color: '#3c2924' },
  amount: { minWidth: 40, textAlign: 'right', fontSize: 15, fontWeight: '800', color: '#8f29dd', paddingRight: 6 },
  webWrap: { flex: 1, backgroundColor: '#fffaf2' },
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
