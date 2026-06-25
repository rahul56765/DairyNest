import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Modal, Pressable, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, UserCircle, Phone, CalendarBlank, ArrowRight, Repeat, MapPin, CreditCard } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, shadow } from "@/src/theme";
import { Txt, Loading, Row, Badge, Button, ChipRow } from "@/src/components/ui";

const FILTERS = ["All", "received", "packed", "out_for_delivery", "delivered"];
const SC: any = {
  received: { c: colors.info, bg: "#E4ECF6" },
  packed: { c: colors.warning, bg: "#FBEEDC" },
  out_for_delivery: { c: colors.brand, bg: "#EAF1E6" },
  delivered: { c: colors.success, bg: "#E3F0E8" },
};
const PAY_SC: any = {
  paid: { c: colors.success, bg: "#E3F0E8" },
  pending: { c: colors.warning, bg: "#FBEEDC" },
  cod_pending: { c: colors.info, bg: "#E4ECF6" },
  failed: { c: colors.error, bg: "#F7E1E1" },
};

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  const callCustomer = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:+91${phone}`).catch(() => {});
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
            const pay = PAY_SC[o.payment_status] || PAY_SC.pending;
            const isSub = !!o.is_subscription;
            const itemsShown = (o.items || []).slice(0, 3);
            const extra = Math.max(0, (o.items || []).length - itemsShown.length);
            const c = o.customer || {};
            const ag = o.agent || null;
            return (
              <Pressable
                key={o.id}
                onPress={() => router.push(`/admin-order/${o.id}` as any)}
                testID={`admin-order-${o.id}`}
                style={[
                  styles.card,
                  isSub && styles.cardSub,
                ]}
              >
                {isSub && (
                  <View style={styles.subBanner}>
                    <Repeat size={14} color={colors.onBrandPrimary} weight="bold" />
                    <Txt color={colors.onBrandPrimary} weight="semibold" size={type.sm} style={{ marginLeft: 6, letterSpacing: 0.4 }}>
                      SUBSCRIPTION ORDER
                    </Txt>
                  </View>
                )}

                {/* Header row */}
                <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Txt weight="semibold" size={type.lg}>#{o.id.slice(0, 8).toUpperCase()}</Txt>
                    <Row style={{ marginTop: 2, gap: 6 }}>
                      <CalendarBlank size={12} color={colors.muted} />
                      <Txt size={type.sm} color={colors.muted}>{formatDate(o.created_at)}</Txt>
                    </Row>
                  </View>
                  <Badge label={o.status.replace(/_/g, " ")} color={sc.c} bg={sc.bg} />
                </Row>

                {/* Customer */}
                <Pressable
                  onPress={() => callCustomer(c.phone)}
                  style={styles.custRow}
                >
                  <View style={styles.avatar}>
                    <UserCircle size={26} color={colors.brandPrimary} weight="fill" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt weight="semibold">{c.name || "—"}</Txt>
                    <Row style={{ gap: 4, marginTop: 2 }}>
                      <Phone size={11} color={colors.muted} />
                      <Txt color={colors.muted} size={type.sm}>+91 {c.phone || "—"}</Txt>
                    </Row>
                  </View>
                </Pressable>

                {/* Items */}
                <View style={styles.itemsBlock}>
                  {itemsShown.map((it: any, i: number) => (
                    <Row key={i} style={{ justifyContent: "space-between", marginTop: i === 0 ? 0 : 4 }}>
                      <Txt size={type.sm} color={colors.onSurfaceTertiary} numberOfLines={1} style={{ flex: 1, marginRight: spacing.sm }}>
                        {it.qty} × {it.product?.name || "Item"}
                      </Txt>
                      <Txt size={type.sm} weight="medium">₹{it.line_total}</Txt>
                    </Row>
                  ))}
                  {extra > 0 && (
                    <Txt size={type.sm} color={colors.muted} style={{ marginTop: 4 }}>+ {extra} more {extra === 1 ? "item" : "items"}</Txt>
                  )}
                </View>

                {/* Bill summary */}
                <View style={styles.billRow}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt size={type.sm} color={colors.muted}>Subtotal</Txt>
                    <Txt size={type.sm}>₹{o.subtotal ?? o.amount}</Txt>
                  </Row>
                  {!!o.discount && (
                    <Row style={{ justifyContent: "space-between", marginTop: 2 }}>
                      <Txt size={type.sm} color={colors.success}>Discount</Txt>
                      <Txt size={type.sm} color={colors.success}>− ₹{o.discount}</Txt>
                    </Row>
                  )}
                  {!!o.delivery_charge && (
                    <Row style={{ justifyContent: "space-between", marginTop: 2 }}>
                      <Txt size={type.sm} color={colors.muted}>Delivery</Txt>
                      <Txt size={type.sm}>₹{o.delivery_charge}</Txt>
                    </Row>
                  )}
                  <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
                    <Txt weight="semibold">Total</Txt>
                    <Txt weight="semibold" color={colors.brandPrimary}>₹{o.amount}</Txt>
                  </Row>
                </View>

                {/* Payment + slot */}
                <Row style={{ flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm }}>
                  <View style={styles.meta}>
                    <CreditCard size={11} color={colors.muted} />
                    <Txt size={type.sm} color={colors.onSurfaceTertiary} style={{ marginLeft: 4 }}>{(o.payment_method || "—").toUpperCase()}</Txt>
                  </View>
                  <Badge label={(o.payment_status || "pending").replace(/_/g, " ")} color={pay.c} bg={pay.bg} />
                  <View style={styles.meta}>
                    <Txt size={type.sm} color={colors.onSurfaceTertiary}>🕒 {o.slot}</Txt>
                  </View>
                </Row>

                {/* Address */}
                <Row style={{ gap: 6, marginTop: spacing.sm, alignItems: "flex-start" }}>
                  <MapPin size={12} color={colors.muted} style={{ marginTop: 2 }} />
                  <Txt size={type.sm} color={colors.onSurfaceTertiary} style={{ flex: 1 }}>
                    {[o.address?.flat, o.address?.apartment, o.address?.area, o.address?.city].filter(Boolean).join(", ") || "No address"}
                  </Txt>
                </Row>

                {/* Agent */}
                <Row style={{ gap: 6, marginTop: 4 }}>
                  <UserCircle size={12} color={colors.muted} />
                  <Txt size={type.sm} color={colors.muted}>
                    {ag ? `Agent: ${ag.name}${ag.phone ? ` · +91 ${ag.phone}` : ""}` : "Unassigned"}
                  </Txt>
                </Row>

                {/* Actions */}
                <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {o.status === "received" && (
                    <Button
                      title="Mark Packed"
                      onPress={() => mark(o.id, "packed")}
                      style={{ flex: 1, height: 40 }}
                      testID={`mark-packed-${o.id}`}
                    />
                  )}
                  {o.status === "packed" && (
                    <Button
                      title={o.agent_id ? "Send Out" : "Assign Agent"}
                      onPress={() => o.agent_id ? mark(o.id, "out_for_delivery") : setPickFor(o.id)}
                      style={{ flex: 1, height: 40 }}
                      testID={`send-out-${o.id}`}
                    />
                  )}
                  {(o.status === "out_for_delivery" || (o.status !== "received" && o.status !== "packed" && o.status !== "delivered")) && (
                    <Button
                      title={o.agent_id ? "Reassign" : "Assign Agent"}
                      onPress={() => setPickFor(o.id)}
                      style={{ flex: 1, height: 40 }}
                      testID={`assign-${o.id}`}
                    />
                  )}
                  {o.status !== "delivered" && o.status !== "received" && (
                    <Button title="Mark Delivered" variant="outline" onPress={() => mark(o.id, "delivered")} style={{ flex: 1, height: 40 }} testID={`mark-delivered-${o.id}`} />
                  )}
                </Row>

                {/* View details hint */}
                <Row style={{ justifyContent: "flex-end", marginTop: spacing.sm }}>
                  <Txt size={type.sm} color={colors.brandPrimary} weight="semibold">View full details</Txt>
                  <ArrowRight size={14} color={colors.brandPrimary} style={{ marginLeft: 4 }} />
                </Row>
              </Pressable>
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
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardSub: {
    borderColor: colors.brandPrimary,
    borderLeftWidth: 4,
    backgroundColor: "#FAFCF8",
  },
  subBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandPrimary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  custRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  itemsBlock: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
  },
  billRow: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
});
