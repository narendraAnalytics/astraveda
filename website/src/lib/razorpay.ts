// Loads Razorpay's Checkout.js once and opens it. Simpler than the mobile
// app's WebView approach — see websiteupdate.txt's architecture notes.
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
};

let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the payment form. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(opts: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  description: string;
  onSuccess: (result: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss: () => void;
}) {
  await loadCheckoutScript();
  const rzp = new window.Razorpay({
    key: opts.keyId,
    order_id: opts.orderId,
    amount: opts.amountPaise,
    currency: "INR",
    name: "AstraVeda",
    description: opts.description,
    theme: { color: "#D6336C" },
    handler: opts.onSuccess,
    modal: { ondismiss: opts.onDismiss },
  });
  rzp.open();
}
