import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Package, CaretRight } from "phosphor-react-native";
import { api } from "@/src/api";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Card, Badge, Loading, Row, Segmented, EmptyState } from "@/src/components/ui";

const STATUS_COLORS: any = {
  received: { c: colors.info, bg: "#E4ECF6" },
  packed: { c: colors.warning, bg: "#FBEEDC" },
  out_for_delivery: { c: colors.brand, bg: "#EAF1E6" },
  delivered: { c: colors.success, bg: "#E3F0E8" },
  cancelled: { c: colors.error, bg: "#F6E4E4" },
  refunded: { c: colors.muted, bg: colors.surfaceTertiary },
};

export default function Orders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState("active");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const o = await api.get(`/orders?status=${tab}`);
      setOrders(o);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface }}>
        <Txt display weight="semibold" size={type["2xl"]} style={{ marginBottom: spacing.md }}>My Orders</Txt>
        <Segmented
          options={[{ label: "Active", value: "active" }, { label: "Past", value: "past" }]}
          value={tab}
          onChange={setTab}
          testIDPrefix="orders-tab"
        />
      </View>
      {loading ? (
        <Loading />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Package size={56} color={colors.borderStrong} />}
          title={tab === "active" ? "No active orders" : "No past orders"}
          subtitle="Order fresh produce to see it here."
          cta="Browse products"
          onCta={() => router.push("/catalog?type=vegetable")}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        >
          {orders.map((o) => {
            const sc = STATUS_COLORS[o.status] || STATUS_COLORS.received;
            return (
              <Pressable key={o.id} testID={`order-${o.id}`} onPress={() => router.push(`/order/${o.id}` as any)}>
                <Card style={{ marginBottom: spacing.md }}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt weight="semibold">Order #{o.id.slice(0, 8).toUpperCase()}</Txt>
                    <Badge label={o.status.replace(/_/g, " ")} color={sc.c} bg={sc.bg} />
                  </Row>
                  <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>
                    {o.items.length} item{o.items.length > 1 ? "s" : ""} · {o.slot} slot · {o.delivery_date}
                  </Txt>
                  <Row style={{ justifyContent: "space-between", marginTop: spacing.md }}>
                    <Txt display weight="semibold" size={type.lg} color={colors.brandPrimary}>₹{o.amount}</Txt>
                    <Row>
                      <Txt weight="medium" size={type.sm} color={colors.brandPrimary}>Track</Txt>
                      <CaretRight size={16} color={colors.brandPrimary} />
                    </Row>
                  </Row>
                </Card>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({});
