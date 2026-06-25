import { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Platform, Modal, Pressable, KeyboardAvoidingView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Leaf, MapPin, Package, X, Sun, MoonStars, ArrowsClockwise, Calendar, Drop } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Header, Button, Badge, Loading, Row, Segmented, QtyStepper } from "@/src/components/ui";

type Option = "one_time" | "weekly" | "monthly";

const SCHEDULE_OPTIONS = [
  { key: "morning", label: "Morning", Icon: Sun },
  { key: "evening", label: "Evening", Icon: MoonStars },
  { key: "both", label: "Both (AM + PM)", Icon: ArrowsClockwise },
];

const FREQ_OPTIONS = [
  { key: "daily", label: "Daily" },
  { key: "alternate", label: "Alternate days" },
];

export default function ProductDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [option, setOption] = useState<Option>("one_time");

  // Subscription modal state
  const [subOpen, setSubOpen] = useState(false);
  const [schedule, setSchedule] = useState<"morning" | "evening" | "both">("morning");
  const [frequency, setFrequency] = useState<"daily" | "alternate">("daily");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/products/${id}`).then(setP).catch(() => {});
  }, [id]);

  if (!p) return <Loading />;

  // For subscriptions, we never multiply qty into the cart anymore. We compute an
  // estimated total to show the customer what they'll be billed upfront.
  const commitmentDays = option === "weekly" ? 7 : option === "monthly" ? 30 : 0;
  const deliveriesPerDay = schedule === "both" ? 2 : 1;
  // Quick estimate: assume daily for weekly/monthly previews. The actual created
  // subscription's `frequency` is what the customer picks in the modal.
  const estimatedDeliveries = option === "one_time" ? 1 : (frequency === "alternate" ? Math.ceil(commitmentDays / 2) : commitmentDays);
  const upfrontTotal = option === "one_time"
    ? p.price * qty
    : Math.round(p.price * deliveriesPerDay * estimatedDeliveries);

  const isMilk = (p.type || "").toLowerCase() === "milk";
  const ctaLabel = option === "one_time" ? "Add to Cart" : option === "weekly" ? "Start Weekly Plan" : "Start Monthly Plan";

  const addOneTime = async () => {
    setBusy(true);
    try {
      await api.post("/cart/add", { product_id: p.id, qty });
      toast.show("Added to cart", "success");
      router.push("/cart");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally { setBusy(false); }
  };

  const onCta = () => {
    if (option === "one_time") return addOneTime();
    setSubOpen(true);
  };

  const startSubscription = async () => {
    setBusy(true);
    try {
      const sub = await api.post("/subscriptions", {
        product_id: p.id,
        milk_type: p.milk_type || p.category || p.name,
        quantity_label: p.weight || "1 L",
        quantity_ml: parseQuantityMl(p.weight),
        schedule,
        frequency,
        commitment_days: commitmentDays,
      });
      toast.show(`${option === "weekly" ? "Weekly" : "Monthly"} plan started!`, "success");
      setSubOpen(false);
      // Route to the new customer subscription calendar
      router.replace(`/subscription/${sub.id}` as any);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Product" back />
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        <Image source={{ uri: p.image }} style={styles.img} contentFit="cover" transition={250} />
        <View style={{ padding: spacing.lg }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt display weight="semibold" size={type["2xl"]} style={{ flex: 1 }}>{p.name}</Txt>
            {p.organic && <Badge label="Organic" />}
          </Row>
          <Txt color={colors.muted} style={{ marginTop: 4 }}>{p.weight} · {p.category}</Txt>
          <Txt display weight="semibold" size={type["2xl"]} color={colors.brandPrimary} style={{ marginTop: spacing.md }}>₹{p.price}{!isMilk && qty > 1 ? "" : ""}</Txt>

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
            onChange={(v) => setOption(v as Option)}
            testIDPrefix="order-option"
          />

          {/* Subscription preview (no longer dumps 30 items into cart) */}
          {option !== "one_time" ? (
            <View style={styles.subPreview}>
              <Row style={{ gap: spacing.sm }}>
                <Calendar size={18} color={colors.brandPrimary} weight="fill" />
                <Txt weight="semibold" color={colors.brandPrimary}>
                  {option === "weekly" ? "7-day" : "30-day"} {isMilk ? "milk" : ""} subscription
                </Txt>
              </Row>
              <Txt color={colors.onSurfaceTertiary} size={type.sm} style={{ marginTop: 6 }}>
                One delivery is scheduled per day. You'll see every delivery in your Orders → Subscription calendar. Cancel anytime.
              </Txt>
            </View>
          ) : (
            <Row style={{ justifyContent: "space-between", marginTop: spacing.xl }}>
              <Txt weight="semibold" size={type.lg}>Quantity</Txt>
              <QtyStepper qty={qty} onChange={(q) => setQty(Math.max(1, q))} testID="product-qty" />
            </Row>
          )}
        </View>
      </ScrollView>

      <BlurView intensity={Platform.OS === "ios" ? 40 : 0} tint="light" style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Txt color={colors.muted} size={type.sm}>
            {option === "one_time" ? "Total" : "Est. upfront"}
          </Txt>
          <Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>₹{upfrontTotal}</Txt>
        </View>
        <Button title={ctaLabel} onPress={onCta} loading={busy} testID="add-to-cart-button" style={{ flex: 1.4 }} />
      </BlurView>

      {/* Subscription setup modal */}
      <Modal visible={subOpen} transparent animationType="slide" onRequestClose={() => setSubOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
              <Txt display weight="semibold" size={type.xl}>
                Setup {option === "weekly" ? "Weekly" : "Monthly"} plan
              </Txt>
              <Pressable onPress={() => setSubOpen(false)} hitSlop={10} testID="sub-modal-close">
                <X size={22} color={colors.onSurface} />
              </Pressable>
            </Row>

            <Row style={{ gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md }}>
              <Drop size={22} color={colors.brandPrimary} weight="fill" />
              <View style={{ flex: 1 }}>
                <Txt weight="semibold">{p.name}</Txt>
                <Txt color={colors.muted} size={type.sm}>{p.weight} · ₹{p.price} per delivery</Txt>
              </View>
            </Row>

            <Txt weight="semibold" size={type.md} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Delivery schedule</Txt>
            {SCHEDULE_OPTIONS.map((opt) => {
              const on = schedule === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setSchedule(opt.key as any)}
                  style={[styles.choice, on && styles.choiceOn]}
                  testID={`sub-sched-${opt.key}`}
                >
                  <opt.Icon size={18} color={on ? colors.brandPrimary : colors.onSurfaceTertiary} weight="fill" />
                  <Txt weight={on ? "semibold" : "regular"} color={on ? colors.brandPrimary : colors.onSurface}>
                    {opt.label}
                  </Txt>
                </Pressable>
              );
            })}

            <Txt weight="semibold" size={type.md} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Frequency</Txt>
            {FREQ_OPTIONS.map((opt) => {
              const on = frequency === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setFrequency(opt.key as any)}
                  style={[styles.choice, on && styles.choiceOn]}
                  testID={`sub-freq-${opt.key}`}
                >
                  <Calendar size={18} color={on ? colors.brandPrimary : colors.onSurfaceTertiary} weight="fill" />
                  <Txt weight={on ? "semibold" : "regular"} color={on ? colors.brandPrimary : colors.onSurface}>
                    {opt.label}
                  </Txt>
                </Pressable>
              );
            })}

            <View style={styles.estBox}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt color={colors.muted}>Commitment</Txt>
                <Txt weight="medium">{commitmentDays} days</Txt>
              </Row>
              <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
                <Txt color={colors.muted}>Estimated deliveries</Txt>
                <Txt weight="medium">{estimatedDeliveries * deliveriesPerDay}</Txt>
              </Row>
              <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
                <Txt weight="semibold">Total upfront (AutoPay)</Txt>
                <Txt weight="semibold" color={colors.brandPrimary}>
                  ₹{Math.round(p.price * deliveriesPerDay * estimatedDeliveries)}
                </Txt>
              </Row>
            </View>

            <Button
              title="Confirm & Start"
              loading={busy}
              onPress={startSubscription}
              style={{ marginTop: spacing.lg }}
              testID="confirm-subscription"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function parseQuantityMl(weight?: string): number {
  if (!weight) return 1000;
  const w = weight.toLowerCase().replace(/\s/g, "");
  const lmatch = w.match(/([\d.]+)l/);
  if (lmatch) return Math.round(parseFloat(lmatch[1]) * 1000);
  const mmatch = w.match(/([\d.]+)ml/);
  if (mmatch) return Math.round(parseFloat(mmatch[1]));
  const gmatch = w.match(/([\d.]+)g/);
  if (gmatch) return Math.round(parseFloat(gmatch[1]));
  return 1000;
}

const styles = StyleSheet.create({
  img: { width: "100%", height: 280, backgroundColor: colors.surfaceTertiary },
  infoRow: { gap: spacing.sm, marginTop: spacing.sm },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: Platform.OS === "ios" ? "rgba(252,250,248,0.8)" : colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },

  subPreview: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandSecondary },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "92%" },

  choice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm },
  choiceOn: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  estBox: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md },
});
