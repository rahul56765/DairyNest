import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Drop, Carrot, Orange, Pause, Receipt, Bell, Sparkle, Sun, MoonStars } from "phosphor-react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius, type, shadow } from "@/src/theme";
import { Txt, Card, Badge, Loading } from "@/src/components/ui";

const QUICK = [
  { key: "milk", label: "Add Milk", Icon: Drop, route: "/(customer)/subscription", bg: "#EAF1E6" },
  { key: "veg", label: "Vegetables", Icon: Carrot, route: "/catalog?type=vegetable", bg: "#FBEEDC" },
  { key: "fruit", label: "Fruits", Icon: Orange, route: "/catalog?type=fruit", bg: "#F6E4E4" },
  { key: "pause", label: "Pause", Icon: Pause, route: "/(customer)/subscription", bg: "#E4ECF6" },
  { key: "bill", label: "View Bill", Icon: Receipt, route: "/billing", bg: "#EDE7F6" },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [insight, setInsight] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ins, s] = await Promise.all([api.get("/ai/insights"), api.get("/subscriptions")]);
      setInsight(ins);
      setSubs(s.filter((x: any) => x.status === "active"));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const morning = subs.some((s) => s.schedule === "morning" || s.schedule === "both");
  const evening = subs.some((s) => s.schedule === "evening" || s.schedule === "both");

  if (loading) return <Loading />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
    >
      <View style={[styles.head, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Txt color={colors.muted} size={type.sm}>{greeting},</Txt>
          <Txt display weight="semibold" size={type["2xl"]} numberOfLines={1}>
            {user?.name?.split(" ")[0] || "Friend"}
          </Txt>
        </View>
        <Pressable testID="notifications-button" style={styles.bell}>
          <Bell size={22} color={colors.onSurfaceTertiary} />
        </Pressable>
      </View>

      {/* Hero */}
      <Pressable testID="hero-banner" onPress={() => router.push("/(customer)/subscription")} style={styles.hero}>
        <Image source={{ uri: "https://images.unsplash.com/photo-1768850418252-37af725e46bb?w=900&q=80" }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["transparent", "rgba(44,66,48,0.85)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroContent}>
          <Badge label="LIMITED OFFER" color={colors.surfaceInverse} bg={colors.warning} />
          <Txt display weight="semibold" size={type["2xl"]} color={colors.onBrandPrimary} style={{ marginTop: spacing.sm }}>
            Get 20% off your{"\n"}first milk subscription
          </Txt>
          <View style={styles.heroCta}>
            <Txt weight="semibold" color={colors.brandPrimary}>Subscribe Now →</Txt>
          </View>
        </View>
      </Pressable>

      {/* Quick actions */}
      <View style={styles.quickWrap}>
        {QUICK.map((q) => (
          <Pressable key={q.key} testID={`quick-${q.key}`} onPress={() => router.push(q.route as any)} style={styles.quick}>
            <View style={[styles.quickIcon, { backgroundColor: q.bg }]}>
              <q.Icon size={24} color={colors.brandPrimary} weight="fill" />
            </View>
            <Txt weight="medium" size={type.sm} style={{ marginTop: 6, textAlign: "center" }}>{q.label}</Txt>
          </Pressable>
        ))}
      </View>

      {/* Today's delivery */}
      <Txt display weight="semibold" size={type.xl} style={styles.sectionTitle}>Today's Delivery</Txt>
      <View style={styles.deliveryRow}>
        <Card style={styles.deliveryCard}>
          <View style={styles.delHead}>
            <Sun size={20} color={colors.warning} weight="fill" />
            <Txt weight="semibold">Morning</Txt>
          </View>
          <Badge label={morning ? "Scheduled" : "No order"} color={morning ? colors.success : colors.muted} bg={morning ? "#E3F0E8" : colors.surfaceTertiary} />
          <Txt color={colors.muted} size={type.sm} style={{ marginTop: spacing.sm }}>
            {morning ? "Arriving by 7:00 AM" : "Add a morning slot"}
          </Txt>
        </Card>
        <Card style={styles.deliveryCard}>
          <View style={styles.delHead}>
            <MoonStars size={20} color={colors.info} weight="fill" />
            <Txt weight="semibold">Evening</Txt>
          </View>
          <Badge label={evening ? "Scheduled" : "No order"} color={evening ? colors.success : colors.muted} bg={evening ? "#E3F0E8" : colors.surfaceTertiary} />
          <Txt color={colors.muted} size={type.sm} style={{ marginTop: spacing.sm }}>
            {evening ? "Arriving by 6:00 PM" : "Add an evening slot"}
          </Txt>
        </Card>
      </View>

      {/* AI insight */}
      {insight && (
        <Card testID="ai-insight-card" style={styles.aiCard}>
          <View style={styles.delHead}>
            <Sparkle size={20} color={colors.brandPrimary} weight="fill" />
            <Txt display weight="semibold" size={type.lg}>Smart Insight</Txt>
          </View>
          <Txt color={colors.onSurfaceTertiary} style={{ marginTop: spacing.sm, lineHeight: 21 }}>{insight.insight}</Txt>
          <View style={styles.aiStats}>
            <View style={styles.aiStat}>
              <Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>₹{insight.monthly_estimate}</Txt>
              <Txt size={type.sm} color={colors.muted}>Est. monthly bill</Txt>
            </View>
            <View style={styles.aiStat}>
              <Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>{insight.recommended_quantity}</Txt>
              <Txt size={type.sm} color={colors.muted}>Recommended/day</Txt>
            </View>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  hero: { height: 180, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: "hidden", ...shadow.card },
  heroContent: { flex: 1, padding: spacing.lg, justifyContent: "flex-end" },
  heroCta: { backgroundColor: colors.onBrandPrimary, alignSelf: "flex-start", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, marginTop: spacing.md },
  quickWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.xl, rowGap: spacing.lg },
  quick: { width: "18%", alignItems: "center" },
  quickIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sectionTitle: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  deliveryRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
  deliveryCard: { flex: 1 },
  delHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  aiCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary },
  aiStats: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.lg },
  aiStat: {},
});
