import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Drop, Pause, Play, SkipForward, PencilSimple, Plus, Wallet } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Card, Badge, Button, Loading, Row, EmptyState } from "@/src/components/ui";

export default function Subscription() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [subs, setSubs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [autopay, setAutopay] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p, a] = await Promise.all([
        api.get("/subscriptions"),
        api.get("/products?type=milk"),
        api.get("/autopay"),
      ]);
      setSubs(s);
      setProducts(p);
      setAutopay(a);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (id: string, action: string) => {
    try {
      await api.post(`/subscriptions/${id}/${action}`);
      toast.show(action === "pause" ? "Subscription paused" : action === "resume" ? "Resumed" : "Tomorrow skipped", "success");
      load();
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  if (loading) return <Loading />;
  const active = subs.filter((s) => s.status !== "cancelled");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing["3xl"] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
    >
      <Txt display weight="semibold" size={type["2xl"]} style={{ paddingHorizontal: spacing.lg }}>My Subscriptions</Txt>

      {/* AutoPay banner */}
      <Pressable testID="autopay-banner" onPress={() => router.push("/autopay")} style={styles.autopay}>
        <Wallet size={24} color={colors.onBrandPrimary} weight="fill" />
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" color={colors.onBrandPrimary}>AutoPay {autopay?.mandate ? "Active" : "Not set up"}</Txt>
          <Txt size={type.sm} color={colors.brandSecondary}>Est. monthly ₹{autopay?.estimated_monthly || 0}</Txt>
        </View>
        <Txt weight="semibold" color={colors.onBrandPrimary}>{autopay?.mandate ? "Manage →" : "Setup →"}</Txt>
      </Pressable>

      {active.length === 0 ? (
        <View style={{ paddingVertical: spacing.xl }}>
          <Txt color={colors.muted} style={{ paddingHorizontal: spacing.lg }}>No active subscriptions yet. Start with farm-fresh milk below.</Txt>
        </View>
      ) : (
        active.map((s) => (
          <Card key={s.id} testID={`sub-card-${s.id}`} style={styles.subCard}>
            <Row>
              <View style={styles.subIcon}>
                <Drop size={22} color={colors.brandPrimary} weight="fill" />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Txt weight="semibold" size={type.lg}>{s.milk_type}</Txt>
                <Txt color={colors.muted} size={type.sm}>{s.quantity_label} · {s.schedule} · {s.frequency}</Txt>
              </View>
              <Badge label={s.status === "active" ? "Active" : "Paused"} color={s.status === "active" ? colors.success : colors.warning} bg={s.status === "active" ? "#E3F0E8" : "#FBEEDC"} />
            </Row>
            <Row style={{ marginTop: spacing.md, justifyContent: "space-between" }}>
              <Txt display weight="semibold" size={type.lg} color={colors.brandPrimary}>₹{s.price_per_delivery}/delivery</Txt>
            </Row>
            <Row style={styles.controls}>
              {s.status === "active" ? (
                <CtrlBtn icon={<Pause size={18} color={colors.onSurfaceTertiary} />} label="Pause" onPress={() => act(s.id, "pause")} testID={`pause-${s.id}`} />
              ) : (
                <CtrlBtn icon={<Play size={18} color={colors.onSurfaceTertiary} />} label="Resume" onPress={() => act(s.id, "resume")} testID={`resume-${s.id}`} />
              )}
              <CtrlBtn icon={<SkipForward size={18} color={colors.onSurfaceTertiary} />} label="Skip 1" onPress={() => act(s.id, "skip-tomorrow")} testID={`skip-${s.id}`} />
              <CtrlBtn icon={<PencilSimple size={18} color={colors.onSurfaceTertiary} />} label="Modify" onPress={() => router.push(`/milk-config?subId=${s.id}&productId=${s.product_id}` as any)} testID={`modify-${s.id}`} />
            </Row>
          </Card>
        ))
      )}

      <Txt display weight="semibold" size={type.xl} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md }}>
        Start a milk plan
      </Txt>
      {products.map((p) => (
        <Pressable key={p.id} testID={`milk-product-${p.id}`} onPress={() => router.push(`/milk-config?productId=${p.id}` as any)}>
          <Card style={styles.prodCard}>
            <Image source={{ uri: p.image }} style={styles.prodImg} contentFit="cover" />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Txt weight="semibold" size={type.lg}>{p.name}</Txt>
              <Txt color={colors.muted} size={type.sm}>{p.farm_source}</Txt>
              <Txt display weight="semibold" color={colors.brandPrimary} style={{ marginTop: 4 }}>₹{p.price}/{p.unit}</Txt>
            </View>
            <View style={styles.plusBtn}>
              <Plus size={20} color={colors.onBrandPrimary} weight="bold" />
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function CtrlBtn({ icon, label, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.ctrl}>
      {icon}
      <Txt weight="medium" size={type.sm} color={colors.onSurfaceTertiary} style={{ marginTop: 4 }}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  autopay: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandPrimary, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg },
  subCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  subIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  controls: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, justifyContent: "space-around" },
  ctrl: { alignItems: "center", flex: 1 },
  prodCard: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.lg, marginBottom: spacing.md },
  prodImg: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  plusBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
});
