import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Image, Linking, Modal, RefreshControl, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import {
  CheckCircle, Circle, Package, Truck, House, Receipt,
  Phone, EnvelopeSimple, UserCircle, Repeat, MapPin, CreditCard,
  Calendar, IdentificationCard, X, ChatCircle,
} from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, shadow } from "@/src/theme";
import { Txt, Header, Card, Loading, Row, Badge, Button } from "@/src/components/ui";

const ICONS: any = { received: Receipt, packed: Package, out_for_delivery: Truck, delivered: House };
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

const STATUS_FLOW = ["received", "packed", "out_for_delivery", "delivered"];

const formatDateTime = (iso?: string) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, a] = await Promise.all([
        api.get(`/admin/orders/${id}`),
        api.get("/admin/agents"),
      ]);
      setOrder(o); setAgents(a);
    } catch (e: any) {
      toast.show(e.message || "Failed to load", "error");
    }
    setRefreshing(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const assign = async (agentId: string, agentName: string) => {
    try {
      await api.put(`/admin/orders/${id}/assign?agent_id=${agentId}`);
      toast.show(`Assigned to ${agentName}`, "success");
      setPickerOpen(false);
      load();
    } catch (e: any) { toast.show(e.message, "error"); }
  };

  const changeStatus = async (status: string) => {
    try {
      await api.put(`/admin/orders/${id}/status`, { status });
      toast.show(`Marked ${status.replace(/_/g, " ")}`, "success");
      setStatusOpen(false);
      load();
    } catch (e: any) { toast.show(e.message, "error"); }
  };

  if (!order) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Order" back /><Loading /></View>;

  const sc = SC[order.status] || SC.received;
  const pay = PAY_SC[order.payment_status] || PAY_SC.pending;
  const c = order.customer || {};
  const ag = order.agent || null;
  const isSub = !!order.is_subscription;
  const refs: any[] = order.subscription_refs || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={`#${order.id.slice(0, 8).toUpperCase()}`} back />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
      >
        {/* Subscription banner */}
        {isSub && (
          <View style={styles.subBanner}>
            <Repeat size={20} color={colors.onBrandPrimary} weight="bold" />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Txt color={colors.onBrandPrimary} weight="semibold">Subscription Order</Txt>
              <Txt color={colors.onBrandPrimary} size={type.sm} style={{ opacity: 0.85 }}>
                Recurring delivery — auto-charged at checkout
              </Txt>
            </View>
          </View>
        )}

        {/* Status overview */}
        <Card style={{ marginBottom: spacing.md }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
            <View>
              <Txt color={colors.muted} size={type.sm}>Current Status</Txt>
              <Badge label={order.status.replace(/_/g, " ").toUpperCase()} color={sc.c} bg={sc.bg} />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Txt color={colors.muted} size={type.sm}>Placed</Txt>
              <Txt size={type.sm}>{formatDateTime(order.created_at)}</Txt>
            </View>
          </Row>

          {(order.tracking || []).map((t: any, i: number) => {
            const Icon = ICONS[t.step] || Circle;
            const last = i === order.tracking.length - 1;
            return (
              <Row key={t.step} style={{ alignItems: "flex-start" }}>
                <View style={{ alignItems: "center" }}>
                  <View style={[styles.dot, { backgroundColor: t.done ? colors.brandPrimary : colors.surfaceTertiary }]}>
                    <Icon size={16} color={t.done ? colors.onBrandPrimary : colors.muted} weight={t.done ? "fill" : "regular"} />
                  </View>
                  {!last && <View style={[styles.line, { backgroundColor: t.done ? colors.brandPrimary : colors.border }]} />}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md, paddingBottom: last ? 0 : spacing.md }}>
                  <Txt weight={t.done ? "semibold" : "medium"} color={t.done ? colors.onSurface : colors.muted}>{t.label}</Txt>
                  {t.done && <Txt size={type.sm} color={colors.success}>Completed</Txt>}
                </View>
              </Row>
            );
          })}
        </Card>

        {/* Customer */}
        <Card style={{ marginBottom: spacing.md }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
            <Txt weight="semibold" size={type.lg}>Customer</Txt>
            {!!c.id && <Badge label="View" color={colors.brandPrimary} bg={colors.brandTertiary} />}
          </Row>
          <Row style={{ gap: spacing.md }}>
            <View style={styles.avatar}><UserCircle size={36} color={colors.brandPrimary} weight="fill" /></View>
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" size={type.lg}>{c.name || "—"}</Txt>
              <Pressable onPress={() => c.phone && Linking.openURL(`tel:+91${c.phone}`).catch(() => {})}>
                <Row style={{ gap: 6, marginTop: 4 }}>
                  <Phone size={13} color={colors.brandPrimary} />
                  <Txt color={colors.brandPrimary} size={type.sm} weight="medium">+91 {c.phone || "—"}</Txt>
                </Row>
              </Pressable>
              {!!c.email && (
                <Row style={{ gap: 6, marginTop: 4 }}>
                  <EnvelopeSimple size={13} color={colors.muted} />
                  <Txt color={colors.muted} size={type.sm}>{c.email}</Txt>
                </Row>
              )}
            </View>
          </Row>
          <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <Button
              title="Call"
              icon={<Phone size={16} color={colors.onBrandPrimary} weight="bold" />}
              onPress={() => c.phone && Linking.openURL(`tel:+91${c.phone}`).catch(() => {})}
              style={{ flex: 1, height: 40 }}
            />
            <Button
              title="WhatsApp"
              variant="outline"
              icon={<ChatCircle size={16} color={colors.brandPrimary} weight="bold" />}
              onPress={() => c.phone && Linking.openURL(`https://wa.me/91${c.phone}`).catch(() => {})}
              style={{ flex: 1, height: 40 }}
            />
          </Row>
        </Card>

        {/* Subscription details */}
        {isSub && refs.length > 0 && (
          <Card style={{ marginBottom: spacing.md, borderColor: colors.brandPrimary, borderWidth: 1 }}>
            <Row style={{ justifyContent: "space-between", marginBottom: spacing.sm }}>
              <Txt weight="semibold" size={type.lg}>Linked Subscriptions</Txt>
              <Repeat size={18} color={colors.brandPrimary} weight="bold" />
            </Row>
            {refs.map((s) => (
              <View key={s.id} style={styles.subCard}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt weight="semibold">{s.milk_type || "Milk"}</Txt>
                  <Badge
                    label={s.status || "active"}
                    color={s.status === "active" ? colors.success : colors.warning}
                    bg={s.status === "active" ? "#E3F0E8" : "#FBEEDC"}
                  />
                </Row>
                <Row style={{ gap: spacing.md, marginTop: 4, flexWrap: "wrap" }}>
                  <Txt size={type.sm} color={colors.muted}>{s.quantity_label || "—"}</Txt>
                  <Txt size={type.sm} color={colors.muted}>· {s.schedule || "morning"}</Txt>
                  <Txt size={type.sm} color={colors.muted}>· {s.frequency || "daily"}</Txt>
                  {!!s.price_per_delivery && (
                    <Txt size={type.sm} color={colors.brandPrimary} weight="semibold">₹{s.price_per_delivery}/delivery</Txt>
                  )}
                </Row>
              </View>
            ))}
          </Card>
        )}

        {/* Items */}
        <Card style={{ marginBottom: spacing.md }}>
          <Txt weight="semibold" size={type.lg} style={{ marginBottom: spacing.sm }}>Items ({order.items?.length || 0})</Txt>
          {(order.items || []).map((it: any, i: number) => {
            const p = it.product || {};
            return (
              <Row key={i} style={[styles.itemRow, i === (order.items.length - 1) && { borderBottomWidth: 0 }]}>
                {p.image ? (
                  <Image source={{ uri: p.image }} style={styles.itemImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.itemImg, { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }]}>
                    <Package size={22} color={colors.brandPrimary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Txt weight="medium" numberOfLines={2}>{p.name || "Item"}</Txt>
                  <Txt size={type.sm} color={colors.muted}>
                    {p.weight ? `${p.weight} · ` : ""}{p.category || p.type || ""}
                  </Txt>
                  <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
                    <Txt size={type.sm} color={colors.muted}>Qty: {it.qty} × ₹{p.price ?? "—"}</Txt>
                    <Txt weight="semibold">₹{it.line_total}</Txt>
                  </Row>
                </View>
              </Row>
            );
          })}
        </Card>

        {/* Bill breakdown */}
        <Card style={{ marginBottom: spacing.md }}>
          <Txt weight="semibold" size={type.lg} style={{ marginBottom: spacing.sm }}>Bill Details</Txt>
          <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
            <Txt color={colors.onSurfaceTertiary}>Subtotal</Txt>
            <Txt>₹{order.subtotal ?? order.amount}</Txt>
          </Row>
          {!!order.discount && (
            <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
              <Txt color={colors.success}>Discount</Txt>
              <Txt color={colors.success}>− ₹{order.discount}</Txt>
            </Row>
          )}
          {!!order.first_order_bonus && (
            <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
              <Txt color={colors.success} size={type.sm}>↳ First-order bonus</Txt>
              <Txt color={colors.success} size={type.sm}>− ₹{order.first_order_bonus}</Txt>
            </Row>
          )}
          <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
            <Txt color={colors.onSurfaceTertiary}>Delivery charge</Txt>
            <Txt>{order.delivery_charge ? `₹${order.delivery_charge}` : "FREE"}</Txt>
          </Row>
          <View style={styles.divider} />
          <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
            <Txt weight="semibold" size={type.lg}>Total Paid</Txt>
            <Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>₹{order.amount}</Txt>
          </Row>
        </Card>

        {/* Payment */}
        <Card style={{ marginBottom: spacing.md }}>
          <Txt weight="semibold" size={type.lg} style={{ marginBottom: spacing.sm }}>Payment</Txt>
          <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
            <Row style={{ gap: 6 }}>
              <CreditCard size={14} color={colors.muted} />
              <Txt color={colors.onSurfaceTertiary}>Method</Txt>
            </Row>
            <Txt weight="medium">{(order.payment_method || "—").toUpperCase()}</Txt>
          </Row>
          <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
            <Txt color={colors.onSurfaceTertiary}>Status</Txt>
            <Badge label={(order.payment_status || "pending").replace(/_/g, " ")} color={pay.c} bg={pay.bg} />
          </Row>
          {!!order.razorpay_order?.id && (
            <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
              <Txt color={colors.onSurfaceTertiary} size={type.sm}>Razorpay Ref</Txt>
              <Txt size={type.sm}>{order.razorpay_order.id}</Txt>
            </Row>
          )}
        </Card>

        {/* Delivery */}
        <Card style={{ marginBottom: spacing.md }}>
          <Txt weight="semibold" size={type.lg} style={{ marginBottom: spacing.sm }}>Delivery</Txt>
          <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
            <Row style={{ gap: 6 }}>
              <Calendar size={14} color={colors.muted} />
              <Txt color={colors.onSurfaceTertiary}>Delivery date</Txt>
            </Row>
            <Txt weight="medium">{order.delivery_date || "—"}</Txt>
          </Row>
          <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
            <Txt color={colors.onSurfaceTertiary}>Slot</Txt>
            <Txt weight="medium" style={{ textTransform: "capitalize" }}>{order.slot}</Txt>
          </Row>
          <Row style={{ gap: 6, marginTop: spacing.sm, alignItems: "flex-start" }}>
            <MapPin size={14} color={colors.muted} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              {!!order.address?.label && <Txt size={type.sm} weight="medium">{order.address.label}</Txt>}
              <Txt color={colors.onSurfaceTertiary} size={type.sm}>
                {[order.address?.flat, order.address?.apartment, order.address?.area, order.address?.city, order.address?.pincode].filter(Boolean).join(", ") || "No address"}
              </Txt>
              {!!order.address?.landmark && (
                <Txt color={colors.muted} size={type.sm}>Landmark: {order.address.landmark}</Txt>
              )}
            </View>
          </Row>
        </Card>

        {/* Agent */}
        <Card style={{ marginBottom: spacing.md }}>
          <Row style={{ justifyContent: "space-between", marginBottom: spacing.sm }}>
            <Txt weight="semibold" size={type.lg}>Delivery Agent</Txt>
            {ag && <Badge label={ag.employee_id || "AGENT"} color={colors.brandPrimary} bg={colors.brandTertiary} />}
          </Row>
          {ag ? (
            <>
              <Row style={{ gap: spacing.md }}>
                <View style={styles.avatar}><UserCircle size={32} color={colors.brandPrimary} weight="fill" /></View>
                <View style={{ flex: 1 }}>
                  <Txt weight="semibold">{ag.name}</Txt>
                  <Row style={{ gap: 4, marginTop: 2 }}>
                    <Phone size={12} color={colors.muted} />
                    <Txt color={colors.muted} size={type.sm}>+91 {ag.phone}</Txt>
                  </Row>
                </View>
                <Pressable onPress={() => ag.phone && Linking.openURL(`tel:+91${ag.phone}`).catch(() => {})} style={styles.callBtn}>
                  <Phone size={18} color={colors.brandPrimary} weight="bold" />
                </Pressable>
              </Row>
              <Button
                title="Reassign Agent"
                variant="outline"
                onPress={() => setPickerOpen(true)}
                style={{ marginTop: spacing.md, height: 42 }}
              />
            </>
          ) : (
            <>
              <Txt color={colors.muted} size={type.sm} style={{ marginBottom: spacing.md }}>No agent assigned yet.</Txt>
              <Button title="Assign Agent" onPress={() => setPickerOpen(true)} style={{ height: 42 }} />
            </>
          )}
        </Card>

        {/* Status actions */}
        <Card style={{ marginBottom: spacing.md }}>
          <Txt weight="semibold" size={type.lg} style={{ marginBottom: spacing.sm }}>Change Status</Txt>
          <View style={{ gap: spacing.sm }}>
            {STATUS_FLOW.map((s) => {
              const active = order.status === s;
              const isc = SC[s];
              return (
                <Pressable
                  key={s}
                  onPress={() => !active && changeStatus(s)}
                  style={[styles.statusBtn, active && { backgroundColor: isc.bg, borderColor: isc.c }]}
                >
                  <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <Row style={{ gap: spacing.sm }}>
                      {active ? <CheckCircle size={18} color={isc.c} weight="fill" /> : <Circle size={18} color={colors.muted} />}
                      <Txt weight={active ? "semibold" : "medium"} color={active ? isc.c : colors.onSurface} style={{ textTransform: "capitalize" }}>
                        {s.replace(/_/g, " ")}
                      </Txt>
                    </Row>
                    {active && <Badge label="CURRENT" color={isc.c} bg={isc.bg} />}
                  </Row>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Meta */}
        <Card>
          <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
            <Row style={{ gap: 6 }}>
              <IdentificationCard size={14} color={colors.muted} />
              <Txt color={colors.muted} size={type.sm}>Order ID</Txt>
            </Row>
            <Txt size={type.sm} weight="medium" style={{ fontFamily: "monospace" }}>{order.id}</Txt>
          </Row>
          <Row style={{ justifyContent: "space-between", paddingVertical: 4 }}>
            <Txt color={colors.muted} size={type.sm}>Source</Txt>
            <Txt size={type.sm} weight="medium" style={{ textTransform: "capitalize" }}>
              {(order.source || "one_time").replace(/_/g, " ")}
            </Txt>
          </Row>
        </Card>
      </ScrollView>

      {/* Agent picker modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
              <Txt display weight="semibold" size={type.xl}>Pick Delivery Agent</Txt>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}><X size={22} color={colors.onSurface} /></Pressable>
            </Row>
            {agents.length === 0 ? (
              <Txt color={colors.muted}>No agents available.</Txt>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {agents.filter((a) => !a.suspended).map((a) => (
                  <Pressable key={a.id} onPress={() => assign(a.id, a.name)} style={styles.agentRow}>
                    <View style={styles.avatar}><UserCircle size={28} color={colors.brandPrimary} weight="fill" /></View>
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
  subBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandPrimary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  line: { width: 2, flex: 1, minHeight: 22, marginVertical: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  subCard: {
    padding: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  itemImg: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  statusBtn: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "80%" },
  agentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
});
