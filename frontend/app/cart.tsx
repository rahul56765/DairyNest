import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, TextInput, Pressable, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trash, Tag, ShoppingCart } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, font } from "@/src/theme";
import { Txt, Header, Button, Loading, Row, QtyStepper, EmptyState } from "@/src/components/ui";

export default function Cart() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [coupon, setCoupon] = useState("");

  const load = useCallback(async () => {
    try {
      const c = await api.get("/cart");
      setCart(c);
    } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateQty = async (pid: string, qty: number) => {
    const c = await api.put("/cart/item", { product_id: pid, qty });
    setCart(c);
  };
  const remove = async (pid: string) => {
    const c = await api.del(`/cart/item/${pid}`);
    setCart(c);
    toast.show("Removed", "info");
  };
  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const c = await api.post("/cart/apply-coupon", { code: coupon, amount: cart.subtotal });
      setCart(c);
      toast.show("Coupon applied!", "success");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Cart" back /><Loading /></View>;

  const empty = !cart || cart.items.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="My Cart" back />
      {empty ? (
        <EmptyState icon={<ShoppingCart size={56} color={colors.borderStrong} />} title="Your cart is empty" subtitle="Add fresh produce to get started." cta="Browse Vegetables" onCta={() => router.replace("/catalog?type=vegetable")} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }}>
            {cart.items.map((it: any) => (
              <View key={it.product.id} style={styles.item} testID={`cart-item-${it.product.id}`}>
                <Image source={{ uri: it.product.image }} style={styles.img} contentFit="cover" />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Txt weight="semibold" numberOfLines={1}>{it.product.name}</Txt>
                  <Txt color={colors.muted} size={type.sm}>₹{it.product.price} · {it.product.weight}</Txt>
                  <Row style={{ justifyContent: "space-between", marginTop: spacing.sm }}>
                    <QtyStepper qty={it.qty} onChange={(q) => updateQty(it.product.id, q)} testID={`cart-qty-${it.product.id}`} />
                    <Txt display weight="semibold" color={colors.brandPrimary}>₹{it.line_total}</Txt>
                  </Row>
                </View>
                <Pressable testID={`remove-${it.product.id}`} onPress={() => remove(it.product.id)} hitSlop={8} style={{ padding: 4 }}>
                  <Trash size={18} color={colors.error} />
                </Pressable>
              </View>
            ))}

            {/* Coupon */}
            <View style={styles.couponRow}>
              <Tag size={20} color={colors.brand} />
              <TextInput
                testID="coupon-input"
                value={coupon}
                onChangeText={(t) => setCoupon(t.toUpperCase())}
                placeholder="Enter coupon code"
                placeholderTextColor={colors.muted}
                style={styles.couponInput}
              />
              <Pressable testID="apply-coupon-button" onPress={applyCoupon}>
                <Txt weight="semibold" color={colors.brandPrimary}>Apply</Txt>
              </Pressable>
            </View>

            {/* Summary */}
            <View style={styles.summary}>
              <SumRow label="Subtotal" value={cart.subtotal} />
              <SumRow label="Delivery" value={cart.delivery_charge} note={cart.delivery_charge === 0 ? "FREE" : undefined} />
              {cart.discount > 0 && <SumRow label={`Discount (${cart.coupon?.code})`} value={-cart.discount} green />}
            </View>
          </ScrollView>

          <BlurView intensity={Platform.OS === "ios" ? 40 : 0} tint="light" style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Txt color={colors.muted} size={type.sm}>Total</Txt>
              <Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>₹{cart.total}</Txt>
            </View>
            <Button title="Checkout" onPress={() => router.push("/checkout")} testID="checkout-button" style={{ flex: 1.4 }} />
          </BlurView>
        </>
      )}
    </View>
  );
}

function SumRow({ label, value, green, note }: any) {
  return (
    <Row style={{ justifyContent: "space-between", marginBottom: spacing.sm }}>
      <Txt color={colors.muted}>{label}</Txt>
      {note ? <Txt weight="semibold" color={colors.success}>{note}</Txt> : <Txt weight="semibold" color={green ? colors.success : colors.onSurface}>₹{value}</Txt>}
    </Row>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, alignItems: "center" },
  img: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  couponRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  couponInput: { flex: 1, height: 50, fontFamily: font.medium, color: colors.onSurface },
  summary: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: spacing.lg },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: Platform.OS === "ios" ? "rgba(252,250,248,0.8)" : colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
});
