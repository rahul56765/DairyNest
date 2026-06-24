import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MapPin, Phone, Check, X, WarningOctagon, SignOut, Buildings } from "phosphor-react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Card, Loading, Row, Badge, EmptyState, Button } from "@/src/components/ui";

export default function AgentRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [summary, setSummary] = useState<any>(null);
  const [route, setRoute] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.get("/agent/summary"), api.get("/agent/route")]);
      setSummary(s);
      setRoute(r);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mark = async (oid: string, status: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    try {
      await api.post(`/agent/delivery/${oid}/status`, { status });
      toast.show(status === "delivered" ? "Marked delivered" : "Marked as failed", status === "delivered" ? "success" : "info");
      load();
    } catch (e: any) { toast.show(e.message, "error"); }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.head, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Txt color={colors.brandSecondary} size={type.sm}>Today's Route</Txt>
          <Txt display weight="semibold" size={type.xl} color={colors.onBrandPrimary}>{user?.name?.split(" ")[0]}</Txt>
        </View>
        <Pressable testID="agent-logout" onPress={signOut} hitSlop={10}><SignOut size={22} color={colors.onBrandPrimary} /></Pressable>
      </View>

      <View style={styles.summaryRow}>
        <Stat label="Total" value={summary?.total || 0} color={colors.onSurface} />
        <Stat label="Delivered" value={summary?.delivered || 0} color={colors.success} />
        <Stat label="Pending" value={summary?.pending || 0} color={colors.warning} />
        <Stat label="Failed" value={summary?.failed || 0} color={colors.error} />
      </View>

      {route.length === 0 ? (
        <EmptyState icon={<Buildings size={56} color={colors.borderStrong} />} title="No deliveries assigned" subtitle="Your route for today is empty." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        >
          {route.map((group) => (
            <View key={group.apartment} style={{ marginBottom: spacing.lg }}>
              <Row style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
                <Buildings size={18} color={colors.brandPrimary} weight="fill" />
                <Txt display weight="semibold" size={type.lg}>{group.apartment}</Txt>
                <Badge label={`${group.stops.length} stops`} />
              </Row>
              {group.stops.map((o: any) => {
                const done = o.status === "delivered";
                const failed = o.status === "failed";
                return (
                  <Card key={o.id} style={{ marginBottom: spacing.md }} testID={`delivery-${o.id}`}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <Txt weight="semibold" size={type.lg}>{o.address?.flat || "—"}</Txt>
                        <Txt color={colors.muted} size={type.sm}>{o.items.length} item(s) · {o.slot} slot</Txt>
                      </View>
                      {(done || failed) && <Badge label={done ? "Delivered" : "Failed"} color={done ? colors.success : colors.error} bg={done ? "#E3F0E8" : "#F6E4E4"} />}
                    </Row>
                    <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                      {o.items.slice(0, 3).map((it: any, i: number) => (
                        <Txt key={i} size={type.sm} color={colors.onSurfaceTertiary}>{it.qty}× {it.product.name}{i < Math.min(o.items.length, 3) - 1 ? "," : ""}</Txt>
                      ))}
                    </Row>
                    {!done && !failed && (
                      <Row style={{ gap: spacing.md, marginTop: spacing.md }}>
                        <Button title="Delivered" onPress={() => mark(o.id, "delivered")} style={{ flex: 1 }} testID={`deliver-${o.id}`} icon={<Check size={18} color={colors.onBrandPrimary} weight="bold" />} />
                        <Button title="Failed" variant="outline" onPress={() => mark(o.id, "not_delivered")} style={{ flex: 1 }} testID={`fail-${o.id}`} />
                      </Row>
                    )}
                    <Row style={{ gap: spacing.md, marginTop: spacing.sm, justifyContent: "flex-end" }}>
                      <Pressable testID={`call-${o.id}`} onPress={() => Linking.openURL("tel:+910000000000")} style={styles.iconBtn}><Phone size={18} color={colors.brandPrimary} weight="fill" /></Pressable>
                      <Pressable testID={`issue-${o.id}`} onPress={() => api.post("/agent/issue", { order_id: o.id, category: "Customer Not Available", note: "" }).then(() => toast.show("Issue reported", "info"))} style={styles.iconBtn}><WarningOctagon size={18} color={colors.warning} weight="fill" /></Pressable>
                    </Row>
                  </Card>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <View style={styles.stat}>
      <Txt display weight="semibold" size={type.xl} color={color}>{value}</Txt>
      <Txt size={type.sm} color={colors.muted}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  summaryRow: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, marginHorizontal: spacing.lg, marginTop: -spacing.lg, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  stat: { flex: 1, alignItems: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});
