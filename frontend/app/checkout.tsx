import { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sun, MoonStars, Calendar, MapPin, Check, ShieldCheck } from "phosphor-react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Header, Button, Loading, Row, Segmented, Card, Badge } from "@/src/components/ui";

const PAYMENTS = [
  { key: "upi", label: "UPI" },
  { key: "card", label: "Card" },
  { key: "netbanking", label: "Net Banking" },
  { key: "cod", label: "Cash on Delivery" },
];

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState<any>(null);
  const [slot, setSlot] = useState("morning");
  const [payment, setPayment] = useState("upi");
  const [placing, setPlacing] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [pay, setPay] = useState<any>({ razorpay_live: false });

  useEffect(() => {
    api.get("/cart").then(setCart).catch(() => {});
    api.get("/settings").then(setSettings).catch(() => {});
    api.get("/payments/config").then(setPay).catch(() => {});
  }, []);

  if (!cart) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Checkout" back /><Loading /></View>;

  const addr = user?.addresses?.find((a: any) => a.id === user?.default_address_id) || user?.addresses?.[0];

  // Preview first-order discount
  const firstDiscountEnabled = !!settings?.first_order_discount_enabled;
  const previewBonus = firstDiscountEnabled
    ? Math.min(
        Math.round(cart.subtotal * (settings.first_order_discount_percent || 0)) / 100,
        settings.first_order_discount_max || 0
      )
    : 0;

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const res = await api.post("/orders/checkout", { slot, payment_method: payment, address_id: addr?.id });
      const orderId = res.order.id;

      if (payment === "cod") {
        toast.show("Order placed! Pay on delivery.", "success");
        router.replace(`/order/${orderId}` as any);
        return;
      }

      // Online payment path — open Razorpay gateway when keys are configured
      const rzpOrder = res.order?.razorpay_order;
      if (pay.razorpay_live && rzpOrder?.id && pay.razorpay_key_id) {
        // Open Razorpay hosted checkout in the system browser.
        // Razorpay sends back to your return_url after success — for dev preview
        // we open hosted_url if present (real Razorpay) or fall back to checkout.razorpay.com page.
        const url = `https://api.razorpay.com/v1/checkout/embedded?key_id=${encodeURIComponent(pay.razorpay_key_id)}&order_id=${encodeURIComponent(rzpOrder.id)}&amount=${rzpOrder.amount}&currency=${rzpOrder.currency || "INR"}&name=DairyNest`;
        await WebBrowser.openBrowserAsync(url);
        toast.show("Complete payment in browser, then confirm in app.", "info");
        router.replace(`/order/${orderId}` as any);
        return;
      }

      // Demo mode (no Razorpay keys): simulate success.
      await api.post(`/orders/${orderId}/confirm-payment`);
      toast.show("Payment successful (demo mode — configure Razorpay keys for live).", "success");
      router.replace(`/order/${orderId}` as any);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Checkout" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
        <Txt display weight="semibold" size={type.lg} style={{ marginBottom: spacing.md }}>Delivery Slot</Txt>
        <Segmented
          options={[{ label: "Morning", value: "morning" }, { label: "Evening", value: "evening" }, { label: "Next Day", value: "next_day" }]}
          value={slot}
          onChange={setSlot}
          testIDPrefix="slot"
        />

        <Txt display weight="semibold" size={type.lg} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Deliver To</Txt>
        <Card>
          <Row>
            <MapPin size={20} color={colors.brandPrimary} weight="fill" />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Txt weight="semibold">{addr?.label || "Home"}</Txt>
              <Txt color={colors.muted} size={type.sm}>{addr ? `${addr.flat}, ${addr.apartment}` : "No address"}</Txt>
            </View>
          </Row>
        </Card>

        <Txt display weight="semibold" size={type.lg} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Payment Method</Txt>
        {PAYMENTS.map((p) => (
          <Pressable key={p.key} testID={`payment-${p.key}`} onPress={() => setPayment(p.key)} style={[styles.payItem, payment === p.key && styles.payActive]}>
            <Txt weight="medium">{p.label}</Txt>
            {payment === p.key && <Check size={20} color={colors.brandPrimary} weight="bold" />}
          </Pressable>
        ))}
        {payment !== "cod" && (
          <Row style={{ gap: 6, marginTop: spacing.sm, paddingHorizontal: 4 }}>
            <ShieldCheck size={14} color={colors.muted} weight="fill" />
            <Txt color={colors.muted} size={type.sm}>
              {pay.razorpay_live ? "Secured by Razorpay" : "Demo mode — Razorpay keys not configured"}
            </Txt>
          </Row>
        )}

        <Card style={{ marginTop: spacing.xl }}>
          <Row style={{ justifyContent: "space-between", marginBottom: spacing.sm }}><Txt color={colors.muted}>Subtotal</Txt><Txt weight="semibold">₹{cart.subtotal}</Txt></Row>
          <Row style={{ justifyContent: "space-between", marginBottom: spacing.sm }}><Txt color={colors.muted}>Delivery</Txt><Txt weight="semibold">{cart.delivery_charge === 0 ? "FREE" : `₹${cart.delivery_charge}`}</Txt></Row>
          {cart.discount > 0 && <Row style={{ justifyContent: "space-between" }}><Txt color={colors.muted}>Discount</Txt><Txt weight="semibold" color={colors.success}>-₹{cart.discount}</Txt></Row>}
          {previewBonus > 0 && (
            <Row style={{ justifyContent: "space-between", marginTop: spacing.sm }}>
              <Row style={{ gap: 6 }}>
                <Badge label="First order" />
                <Txt color={colors.muted}>{settings.first_order_discount_percent}% off</Txt>
              </Row>
              <Txt weight="semibold" color={colors.success}>-₹{previewBonus.toFixed(2)}</Txt>
            </Row>
          )}
        </Card>
      </ScrollView>

      <BlurView intensity={Platform.OS === "ios" ? 40 : 0} tint="light" style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Txt color={colors.muted} size={type.sm}>Pay</Txt>
          <Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>₹{Math.max(0, cart.total - previewBonus).toFixed(2)}</Txt>
        </View>
        <Button title={payment === "cod" ? "Place Order" : "Pay Now"} onPress={placeOrder} loading={placing} testID="place-order-button" style={{ flex: 1.4 }} />
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  payItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm },
  payActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: Platform.OS === "ios" ? "rgba(252,250,248,0.8)" : colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
});
