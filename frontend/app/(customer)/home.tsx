import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Drop, Carrot, Bell, Sun, MoonStars, ArrowRight } from "phosphor-react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius, type, shadow } from "@/src/theme";
import { Txt, Card, Badge, Loading } from "@/src/components/ui";
import { LocationBanner } from "@/src/components/location-banner";
import { BrandMark } from "@/src/components/brand";

const CATEGORIES = [
  { key: "milk",    label: "Milk",                Icon: Drop,   route: "/catalog?type=milk",            tag: "Subscribe or buy once",  bg: "#EAF1E6" },
  { key: "produce", label: "Fruits & Vegetables", Icon: Carrot, route: "/catalog?type=fruit,vegetable", tag: "Farm fresh, daily picks", bg: "#FBEEDC" },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.get("/subscriptions");
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
        <BrandMark size={40} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Txt color={colors.muted} size={type.sm}>{greeting},</Txt>
          <Txt display weight="semibold" size={type["2xl"]} numberOfLines={1}>
            {user?.name?.split(" ")[0] || "Friend"}
          </Txt>
        </View>
        <Pressable testID="notifications-button" style={styles.bell}>
          <Bell size={22} color={colors.onSurfaceTertiary} />
        </Pressable>
      </View>

      <LocationBanner />

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

      {/* Category cards */}
      <View style={styles.quickWrap}>
        {CATEGORIES.map((c) => (
          <Pressable key={c.key} testID={`cat-${c.key}`} onPress={() => router.push(c.route as any)} style={[styles.catCard, { backgroundColor: c.bg }]}>
            <View style={styles.catIcon}>
              <c.Icon size={28} color={colors.brandPrimary} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt display weight="semibold" size={type.lg}>{c.label}</Txt>
              <Txt color={colors.muted} size={type.sm}>{c.tag}</Txt>
            </View>
            <ArrowRight size={20} color={colors.brandPrimary} weight="bold" />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  hero: { height: 180, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: "hidden", ...shadow.card },
  heroContent: { flex: 1, padding: spacing.lg, justifyContent: "flex-end" },
  heroCta: { backgroundColor: colors.onBrandPrimary, alignSelf: "flex-start", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, marginTop: spacing.md },
  quickWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md },
  catCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  catIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  sectionTitle: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  deliveryRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
  deliveryCard: { flex: 1 },
  delHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  aiCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary },
  aiStats: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.lg },
  aiStat: {},
});
