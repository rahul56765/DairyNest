import { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TextInput, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, font } from "@/src/theme";
import { Txt, Button, Header, Chip, Segmented, Row } from "@/src/components/ui";

const QTY = [
  { label: "250 ml", ml: 250 },
  { label: "500 ml", ml: 500 },
  { label: "1 Liter", ml: 1000 },
];
const PRICE: any = { "Cow Milk": 0.06, "Buffalo Milk": 0.08, "A2 Milk": 0.12 };

export default function MilkConfig() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { productId, subId } = useLocalSearchParams<{ productId: string; subId?: string }>();
  const [product, setProduct] = useState<any>(null);
  const [mode, setMode] = useState<"subscribe" | "buy_once">("subscribe");
  const [qtyLabel, setQtyLabel] = useState("500 ml");
  const [qtyMl, setQtyMl] = useState(500);
  const [custom, setCustom] = useState("");
  const [schedule, setSchedule] = useState("morning");
  const [frequency, setFrequency] = useState("daily");
  const [oneTimeQty, setOneTimeQty] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (productId) api.get(`/products/${productId}`).then(setProduct).catch(() => {});
  }, [productId]);

  const milkType = product?.milk_type || "Cow Milk";
  const effectiveMl = custom ? parseInt(custom) || 0 : qtyMl;
  const perDelivery = (PRICE[milkType] || 0.06) * effectiveMl * (schedule === "both" ? 2 : 1);
  const oneTimeTotal = (product?.price || 0) * oneTimeQty;

  const save = async () => {
    if (mode === "buy_once") {
      if (oneTimeQty < 1) return toast.show("Choose a quantity", "error");
      setSaving(true);
      try {
        await api.post("/cart/add", { product_id: productId, qty: oneTimeQty });
        toast.show(`Added ${oneTimeQty} × ${product?.name} to cart`, "success");
        router.replace("/cart" as any);
      } catch (e: any) { toast.show(e.message, "error"); } finally { setSaving(false); }
      return;
    }
    if (effectiveMl <= 0) return toast.show("Choose a valid quantity", "error");
    setSaving(true);
    try {
      const body = {
        product_id: productId,
        milk_type: milkType,
        quantity_label: custom ? `${custom} ml` : qtyLabel,
        quantity_ml: effectiveMl,
        schedule,
        frequency,
      };
      if (subId) await api.put(`/subscriptions/${subId}`, body);
      else await api.post("/subscriptions", body);
      toast.show(subId ? "Subscription updated" : "Subscription created!", "success");
      router.replace("/autopay");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={subId ? "Modify Plan" : "New Subscription"} back />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.hero}>
          {product && <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill} contentFit="cover" />}
          <LinearGradient colors={["transparent", "rgba(44,66,48,0.9)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroText}>
            <Txt display weight="semibold" size={type["2xl"]} color={colors.onBrandPrimary}>{milkType}</Txt>
            <Txt color={colors.brandSecondary}>{product?.farm_source || "Farm sourced"}</Txt>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Segmented
            options={[{ label: "Subscribe daily", value: "subscribe" }, { label: "Buy once", value: "buy_once" }]}
            value={mode}
            onChange={(v) => setMode(v as any)}
            testIDPrefix="mode"
          />
        </View>

        {mode === "subscribe" ? (<>
        <Section title="Quantity">
          <Row style={{ gap: spacing.sm, flexWrap: "wrap" }}>
            {QTY.map((q) => (
              <Chip key={q.label} testID={`qty-${q.ml}`} label={q.label} active={!custom && qtyLabel === q.label} onPress={() => { setCustom(""); setQtyLabel(q.label); setQtyMl(q.ml); }} />
            ))}
          </Row>
          <Row style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Txt color={colors.muted}>Custom (ml):</Txt>
            <TextInput
              testID="custom-qty-input"
              value={custom}
              onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 750"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={styles.customInput}
            />
          </Row>
        </Section>

        <Section title="Delivery Schedule">
          <Segmented
            options={[{ label: "Morning", value: "morning" }, { label: "Evening", value: "evening" }, { label: "Both", value: "both" }]}
            value={schedule}
            onChange={setSchedule}
            testIDPrefix="schedule"
          />
        </Section>

        <Section title="Frequency">
          <Segmented
            options={[{ label: "Daily", value: "daily" }, { label: "Alternate", value: "alternate" }, { label: "Weekly", value: "weekly" }]}
            value={frequency}
            onChange={setFrequency}
            testIDPrefix="frequency"
          />
        </Section>
        </>) : (
          <Section title="How many today?">
            <Row style={{ gap: spacing.sm }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} testID={`one-qty-${n}`} label={`${n}`} active={oneTimeQty === n} onPress={() => setOneTimeQty(n)} />
              ))}
            </Row>
            <Txt color={colors.muted} size={type.sm} style={{ marginTop: spacing.md }}>
              One-time delivery — pay at checkout, no subscription created.
            </Txt>
          </Section>
        )}
      </ScrollView>

      <BlurView intensity={Platform.OS === "ios" ? 40 : 0} tint="light" style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Txt color={colors.muted} size={type.sm}>{mode === "subscribe" ? "Per delivery" : "Total"}</Txt>
          <Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>
            ₹{(mode === "subscribe" ? perDelivery : oneTimeTotal).toFixed(2)}
          </Txt>
        </View>
        <Button
          title={mode === "subscribe" ? "Checkout" : "Add to Cart"}
          onPress={save}
          loading={saving}
          testID="save-subscription-button"
          style={{ flex: 1.4 }}
        />
      </BlurView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
      <Txt display weight="semibold" size={type.lg} style={{ marginBottom: spacing.md }}>{title}</Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 160, backgroundColor: colors.surfaceTertiary, justifyContent: "flex-end" },
  heroText: { padding: spacing.lg },
  customInput: { flex: 1, height: 44, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceSecondary, fontFamily: font.medium, color: colors.onSurface },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: Platform.OS === "ios" ? "rgba(252,250,248,0.8)" : colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
});
