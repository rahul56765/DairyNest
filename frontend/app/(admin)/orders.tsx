import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Modal, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, UserCircle } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
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
  const [pickFor, setPickFor] = useState<string | null>(null);

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

  const doAssign = async (agentId: string, agentName: string) => {
    if (!pickFor) return;
    try {
      await api.put(`/admin/orders/${pickFor}/assign?agent_id=${agentId}`);
      toast.show(`Assigned to ${agentName}`, "success");
      setPickFor(null);
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
            const assignedAgent = agents.find((a) => a.id === o.agent_id);
            return (
              <Card key={o.id} style={{ marginBottom: spacing.md }} testID={`admin-order-${o.id}`}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt weight="semibold">#{o.id.slice(0, 8).toUpperCase()}</Txt>
                  <Badge label={o.status.replace(/_/g, " ")} color={sc.c} bg={sc.bg} />
                </Row>
                <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>{o.items.length} items · ₹{o.amount} · {o.slot}</Txt>
                <Txt color={colors.muted} size={type.sm}>{o.address?.apartment} {o.address?.flat}</Txt>
                <Row style={{ gap: spacing.sm, marginTop: 4 }}>
                  <UserCircle size={14} color={colors.muted} />
                  <Txt color={colors.muted} size={type.sm}>{assignedAgent ? `Agent: ${assignedAgent.name}` : "Unassigned"}</Txt>
                </Row>
                <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {o.status !== "delivered" && (
                    <Button
                      title={o.agent_id ? "Reassign" : "Assign Agent"}
                      onPress={() => setPickFor(o.id)}
                      style={{ flex: 1, height: 40 }}
                      testID={`assign-${o.id}`}
                    />
                  )}
                  {o.status !== "delivered" && <Button title="Mark Delivered" variant="outline" onPress={() => mark(o.id, "delivered")} style={{ flex: 1, height: 40 }} testID={`mark-delivered-${o.id}`} />}
                </Row>
              </Card>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!pickFor} transparent animationType="slide" onRequestClose={() => setPickFor(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
              <Txt display weight="semibold" size={type.xl}>Pick Delivery Agent</Txt>
              <Pressable onPress={() => setPickFor(null)} hitSlop={10} testID="picker-close"><X size={22} color={colors.onSurface} /></Pressable>
            </Row>
            {agents.length === 0 ? (
              <Txt color={colors.muted}>No agents available. Create one from Management → Agents.</Txt>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {agents.filter((a) => !a.suspended).map((a) => (
                  <Pressable key={a.id} onPress={() => doAssign(a.id, a.name)} style={styles.agentRow} testID={`pick-agent-${a.id}`}>
                    <View style={styles.avatar}>
                      <UserCircle size={28} color={colors.brandPrimary} weight="fill" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt weight="semibold">{a.name}</Txt>
                      <Txt color={colors.muted} size={type.sm}>+91 {a.phone} · Delivered: {a.delivered_count ?? 0}</Txt>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "80%" },
  agentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});
