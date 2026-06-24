import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, type } from "@/src/theme";
import { Txt, Card, Loading, Row, Badge, Button, ChipRow } from "@/src/components/ui";

const FILTERS = ["All", "received", "packed", "out_for_delivery", "delivered"];
const SC: any = {
  received: { c: colors.info, bg: "#E4ECF6" },
  packed: { c: colors.warning, bg: "#FBEEDC" },
  out_for_delivery: { c: colors.brand, bg: "#EAF1E6" },
  delivered: { c: colors.success, bg: "#E3F0E8" },
};

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [filter, setFilter] = useState("All");
  const [orders, setOrders] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, a] = await Promise.all([
        api.get(`/admin/orders${filter === "All" ? "" : `?status=${filter}`}`),
        api.get("/admin/agents"),
      ]);
      setOrders(o); setAgents(a);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [filter]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const assign = async (oid: string) => {
    if (agents.length === 0) return toast.show("No agents available", "error");
    try {
      await api.put(`/admin/orders/${oid}/assign?agent_id=${agents[0].id}`);
      toast.show(`Assigned to ${agents[0].name}`, "success");
      load();
    } catch (e: any) { toast.show(e.message, "error"); }
  };
  const mark = async (oid: string, status: string) => {
    try {
      await api.put(`/admin/orders/${oid}/status`, { status });
      toast.show(`Marked ${status.replace(/_/g, " ")}`, "success");
      load();
    } catch (e: any) { toast.show(e.message, "error"); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md }}>
        <Txt display weight="semibold" size={type["2xl"]} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>Orders</Txt>
        <ChipRow options={FILTERS.map((f) => f === "All" ? "All" : f.replace(/_/g, " "))} value={filter === "All" ? "All" : filter.replace(/_/g, " ")} onChange={(v) => setFilter(v === "All" ? "All" : v.replace(/ /g, "_"))} testIDPrefix="order-filter" />
      </View>
      {loading ? <Loading /> : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        >
          {orders.length === 0 ? <Txt color={colors.muted}>No orders found.</Txt> : orders.map((o) => {
            const sc = SC[o.status] || SC.received;
            return (
              <Card key={o.id} style={{ marginBottom: spacing.md }} testID={`admin-order-${o.id}`}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt weight="semibold">#{o.id.slice(0, 8).toUpperCase()}</Txt>
                  <Badge label={o.status.replace(/_/g, " ")} color={sc.c} bg={sc.bg} />
                </Row>
                <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>{o.items.length} items · ₹{o.amount} · {o.slot}</Txt>
                <Txt color={colors.muted} size={type.sm}>{o.address?.apartment} {o.address?.flat} · Agent: {o.agent_id ? "Assigned" : "Unassigned"}</Txt>
                <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {!o.agent_id && o.status !== "delivered" && <Button title="Assign Agent" onPress={() => assign(o.id)} style={{ flex: 1, height: 40 }} testID={`assign-${o.id}`} />}
                  {o.status !== "delivered" && <Button title="Mark Delivered" variant="outline" onPress={() => mark(o.id, "delivered")} style={{ flex: 1, height: 40 }} testID={`mark-delivered-${o.id}`} />}
                </Row>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({});
