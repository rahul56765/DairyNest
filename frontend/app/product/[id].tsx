import { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Leaf, MapPin, Package } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Header, Button, Badge, Loading, Row, Segmented, QtyStepper } from "@/src/components/ui";

export default function ProductDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [option, setOption] = useState("one_time");

  useEffect(() => {
    api.get(`/products/${id}`).then(setP).catch(() => {});
  }, [id]);

  if (!p) return <Loading />;

  const multiplier = option === "weekly" ? 7 : option === "monthly" ? 30 : 1;
  const total = p.price * qty * multiplier;

  const add = async () => {
    try {
      await api.post("/cart/add", { product_id: p.id, qty: qty * multiplier });
      toast.show("Added to cart", "success");
      router.push("/cart");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Product" back />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Image source={{ uri: p.image }} style={styles.img} contentFit="cover" transition={250} />
        <View style={{ padding: spacing.lg }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt display weight="semibold" size={type["2xl"]} style={{ flex: 1 }}>{p.name}</Txt>
            {p.organic && <Badge label="Organic" />}
          </Row>
          <Txt color={colors.muted} style={{ marginTop: 4 }}>{p.weight} · {p.category}</Txt>
          <Txt display weight="semibold" size={type["2xl"]} color={colors.brandPrimary} style={{ marginTop: spacing.md }}>₹{p.price}</Txt>

          <Row style={[styles.infoRow, { marginTop: spacing.lg }]}>
            <MapPin size={18} color={colors.brand} weight="fill" />
            <Txt color={colors.onSurfaceTertiary}>Farm: {p.farm_source}</Txt>
          </Row>
          <Row style={styles.infoRow}>
            <Package size={18} color={colors.brand} weight="fill" />
            <Txt color={colors.onSurfaceTertiary}>{p.stock > 0 ? `In stock (${p.stock})` : "Out of stock"}</Txt>
          </Row>
          {p.organic && (
            <Row style={styles.infoRow}>
              <Leaf size={18} color={colors.success} weight="fill" />
              <Txt color={colors.onSurfaceTertiary}>Certified organic produce</Txt>
            </Row>
          )}

          <Txt display weight="semibold" size={type.lg} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Ordering Options</Txt>
          <Segmented
            options={[{ label: "One Time", value: "one_time" }, { label: "Weekly", value: "weekly" }, { label: "Monthly", value: "monthly" }]}
            value={option}
            onChange={setOption}
            testIDPrefix="order-option"
          />

          <Row style={{ justifyContent: "space-between", marginTop: spacing.xl }}>
            <Txt weight="semibold" size={type.lg}>Quantity</Txt>
            <QtyStepper qty={qty} onChange={(q) => setQty(Math.max(1, q))} testID="product-qty" />
          </Row>
        </View>
      </ScrollView>

      <BlurView intensity={Platform.OS === "ios" ? 40 : 0} tint="light" style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Txt color={colors.muted} size={type.sm}>Total</Txt>
          <Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>₹{total}</Txt>
        </View>
        <Button title="Add to Cart" onPress={add} testID="add-to-cart-button" style={{ flex: 1.4 }} />
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: "100%", height: 280, backgroundColor: colors.surfaceTertiary },
  infoRow: { gap: spacing.sm, marginTop: spacing.sm },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: Platform.OS === "ios" ? "rgba(252,250,248,0.8)" : colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
});
