import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { SignOut, TrendUp } from "phosphor-react-native";
import { api } from "@/src/api";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Card, Loading, Row } from "@/src/components/ui";

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api.get("/admin/dashboard")); } catch {}
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <Loading />;
  const k = data.kpis;
  const kpis = [
    { label: "Total Customers", value: k.total_customers, color: colors.brandPrimary },
    { label: "Active Subs", value: k.active_subscriptions, color: colors.success },
    { label: "Today's Orders", value: k.today_orders, color: colors.info },
    { label: "Today's Revenue", value: `₹${k.today_revenue}`, color: colors.brand },
    { label: "Pending Pay", value: k.pending_payments, color: colors.warning },
    { label: "Failed Recurring", value: k.failed_autopay, color: colors.error },
    { label: "New Referrals", value: k.new_referrals, color: colors.brandPrimary },
    { label: "Conversion", value: `${k.conversion_rate}%`, color: colors.success },
  ];
  const maxSale = Math.max(...data.sales_chart.map((s: any) => s.value), 1);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
    >
      <View style={[styles.head, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Txt color={colors.brandSecondary} size={type.sm}>DairyNest Control Center</Txt>
          <Txt display weight="semibold" size={type.xl} color={colors.onBrandPrimary}>Dashboard</Txt>
        </View>
        <Pressable testID="admin-logout" onPress={signOut} hitSlop={10}><SignOut size={22} color={colors.onBrandPrimary} /></Pressable>
      </View>

      <Card style={styles.revenueCard}>
        <Row style={{ gap: spacing.sm }}><TrendUp size={20} color={colors.success} weight="bold" /><Txt color={colors.muted}>Total Revenue (paid)</Txt></Row>
        <Txt display weight="semibold" size={type["3xl"]} color={colors.brandPrimary} style={{ marginTop: spacing.xs }}>₹{k.total_revenue}</Txt>
      </Card>

      <View style={styles.grid}>
        {kpis.map((kpi) => (
          <Card key={kpi.label} style={styles.kpi}>
            <Txt display weight="semibold" size={type["2xl"]} color={kpi.color}>{kpi.value}</Txt>
            <Txt color={colors.muted} size={type.sm} numberOfLines={1}>{kpi.label}</Txt>
          </Card>
        ))}
      </View>

      <Txt display weight="semibold" size={type.lg} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md }}>Daily Sales (7 days)</Txt>
      <Card style={{ marginHorizontal: spacing.lg }}>
        <View style={styles.chart}>
          {data.sales_chart.map((s: any, i: number) => (
            <View key={i} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.max((s.value / maxSale) * 100, 3)}%` }]} />
              </View>
              <Txt size={type.sm} color={colors.muted}>{s.day}</Txt>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  revenueCard: { marginHorizontal: spacing.lg, marginTop: -spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.lg, rowGap: spacing.md },
  kpi: { width: "48%" },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 160 },
  barCol: { flex: 1, alignItems: "center", gap: spacing.sm, height: "100%", justifyContent: "flex-end" },
  barTrack: { flex: 1, width: 18, justifyContent: "flex-end" },
  bar: { width: 18, backgroundColor: colors.brand, borderRadius: 4, minHeight: 4 },
});
