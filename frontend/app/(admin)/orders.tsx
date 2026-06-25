import { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Modal, Pressable, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, UserCircle, Phone, CalendarBlank, ArrowRight, Repeat, MapPin, CreditCard, CaretLeft, CaretRight, Calendar, ListChecks } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, shadow } from "@/src/theme";
import { Txt, Loading, Row, Badge, Button, ChipRow } from "@/src/components/ui";

const FILTERS = ["All", "received", "packed", "out_for_delivery", "delivered"];
const KIND_TABS: { key: "all" | "subscription" | "normal"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "subscription", label: "Subscriptions" },
  { key: "normal", label: "Normal" },
];
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

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const prettyDate = (iso: string) => {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
};

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<"all" | "subscription" | "normal">("all");
  const [filter, setFilter] = useState("All");
  const [deliveryDate, setDeliveryDate] = useState<string>(""); // "" = all dates
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickFor, setPickFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const qp = new URLSearchParams();
      if (filter !== "All") qp.set("status", filter);
      if (kind !== "all") qp.set("kind", kind);
      if (deliveryDate) qp.set("delivery_date", deliveryDate);
      const qs = qp.toString();
      const [o, a] = await Promise.all([
        api.get(`/admin/orders${qs ? `?${qs}` : ""}`),
        api.get("/admin/agents"),
      ]);
      setOrders(o); setAgents(a);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [filter, kind, deliveryDate]);
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

  const counts = useMemo(() => {
    const sub = orders.filter((o) => o.is_subscription).length;
    return { all: orders.length, subscription: sub, normal: orders.length - sub };
  }, [orders]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md }}>
        <Row style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md, justifyContent: "space-between" }}>
          <Txt display weight="semibold" size={type["2xl"]}>Orders</Txt>
          <Pressable
            onPress={() => router.push("/admin-subscription-calendar" as any)}
            testID="open-subscription-calendar"
            style={styles.calBtn}
          >
            <Calendar size={16} color={colors.brandPrimary} weight="fill" />
            <Txt weight="semibold" size={type.sm} color={colors.brandPrimary}>Subscriptions Calendar</Txt>
          </Pressable>
        </Row>

        {/* Kind tabs */}
        <View style={styles.kindTabs}>
          {KIND_TABS.map((k) => {
            const on = kind === k.key;
            const count = counts[k.key] ?? 0;
            return (
              <Pressable
                key={k.key}
                onPress={() => setKind(k.key)}
                testID={`kind-tab-${k.key}`}
                style={[styles.kindTab, on && styles.kindTabOn]}
              >
                <Txt weight="semibold" size={type.sm} color={on ? colors.onBrandPrimary : colors.onSurface}>
                  {k.label}
                </Txt>
                <View style={[styles.kindCount, on && styles.kindCountOn]}>
                  <Txt size={type.xs} weight="semibold" color={on ? colors.brandPrimary : colors.onSurface}>
                    {count}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Date filter */}
        <View style={styles.dateBar}>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            testID="open-date-picker"
            style={styles.dateBtn}
          >
            <Calendar size={14} color={colors.brandPrimary} weight="fill" />
            <Txt weight="semibold" size={type.sm} color={colors.brandPrimary}>
              {deliveryDate ? prettyDate(deliveryDate) : "All dates"}
            </Txt>
          </Pressable>
          {!!deliveryDate && (
            <Pressable
              onPress={() => setDeliveryDate("")}
              testID="clear-date-filter"
              style={styles.clearBtn}
            >
              <X size={12} color={colors.muted} weight="bold" />
              <Txt size={type.sm} color={colors.muted}>Clear</Txt>
            </Pressable>
          )}
        </View>

        <ChipRow options={FILTERS.map((f) => f === "All" ? "All" : f.replace(/_/g, " "))} value={filter === "All" ? "All" : filter.replace(/_/g, " ")} onChange={(v) => setFilter(v === "All" ? "All" : v.replace(/ /g, "_"))} testIDPrefix="order-filter" />
      </View>
      {loading ? <Loading /> : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        >
          {orders.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: spacing["3xl"] }}>
              <ListChecks size={36} color={colors.muted} />
              <Txt color={colors.muted} style={{ marginTop: spacing.sm, textAlign: "center" }}>
                No {kind === "subscription" ? "subscription" : kind === "normal" ? "normal" : ""} orders {deliveryDate ? `for ${prettyDate(deliveryDate)}` : "found"}.
              </Txt>
            </View>
          ) : orders.map((o) => {
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

                <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Txt weight="semibold" size={type.lg}>#{o.id.slice(0, 8).toUpperCase()}</Txt>
                    <Row style={{ marginTop: 2, gap: 6 }}>
                      <CalendarBlank size={12} color={colors.muted} />
                      <Txt size={type.sm} color={colors.muted}>{formatDate(o.created_at)}</Txt>
                    </Row>
                    {o.delivery_date && (
                      <Row style={{ marginTop: 2, gap: 6 }}>
                        <Calendar size={11} color={colors.brandPrimary} />
                        <Txt size={type.sm} color={colors.brandPrimary}>Deliver: {prettyDate(o.delivery_date)}</Txt>
                      </Row>
                    )}
                  </View>
                  <Badge label={o.status.replace(/_/g, " ")} color={sc.c} bg={sc.bg} />
                </Row>

                <Pressable onPress={() => callCustomer(c.phone)} style={styles.custRow}>
                  <View style={styles.avatar}><UserCircle size={26} color={colors.brandPrimary} weight="fill" /></View>
                  <View style={{ flex: 1 }}>
                    <Txt weight="semibold">{c.name || "—"}</Txt>
                    <Row style={{ gap: 4, marginTop: 2 }}>
                      <Phone size={11} color={colors.muted} />
                      <Txt color={colors.muted} size={type.sm}>+91 {c.phone || "—"}</Txt>
                    </Row>
                  </View>
                </Pressable>

                <View style={styles.itemsBlock}>
                  {itemsShown.map((it: any, i: number) => (
                    <Row key={i} style={{ justifyContent: "space-between", marginTop: i === 0 ? 0 : 4 }}>
                      <Txt size={type.sm} color={colors.onSurfaceTertiary} numberOfLines={1} style={{ flex: 1, marginRight: spacing.sm }}>
                        {it.qty} × {it.product?.name || "Item"}
                      </Txt>
                      <Txt size={type.sm} weight="medium">₹{it.line_total}</Txt>
                    </Row>
                  ))}
                  {extra > 0 && <Txt size={type.sm} color={colors.muted} style={{ marginTop: 4 }}>+ {extra} more {extra === 1 ? "item" : "items"}</Txt>}
                </View>

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

                <Row style={{ flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm }}>
                  <View style={styles.meta}>
                    <CreditCard size={11} color={colors.muted} />
                    <Txt size={type.sm} color={colors.onSurfaceTertiary} style={{ marginLeft: 4 }}>{(o.payment_method || "—").toUpperCase()}</Txt>
                  </View>
                  <Badge label={(o.payment_status || "pending").replace(/_/g, " ")} color={pay.c} bg={pay.bg} />
                  <View style={styles.meta}><Txt size={type.sm} color={colors.onSurfaceTertiary}>🕒 {o.slot}</Txt></View>
                </Row>

                <Row style={{ gap: 6, marginTop: spacing.sm, alignItems: "flex-start" }}>
                  <MapPin size={12} color={colors.muted} style={{ marginTop: 2 }} />
                  <Txt size={type.sm} color={colors.onSurfaceTertiary} style={{ flex: 1 }}>
                    {[o.address?.flat, o.address?.apartment, o.address?.area, o.address?.city].filter(Boolean).join(", ") || "No address"}
                  </Txt>
                </Row>

                <Row style={{ gap: 6, marginTop: 4 }}>
                  <UserCircle size={12} color={colors.muted} />
                  <Txt size={type.sm} color={colors.muted}>
                    {ag ? `Agent: ${ag.name}${ag.phone ? ` · +91 ${ag.phone}` : ""}` : "Unassigned"}
                  </Txt>
                </Row>

                <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {o.status === "received" && (
                    <Button title="Mark Packed" onPress={() => mark(o.id, "packed")} style={{ flex: 1, height: 40 }} testID={`mark-packed-${o.id}`} />
                  )}
                  {o.status === "packed" && (
                    <Button title={o.agent_id ? "Send Out" : "Assign Agent"} onPress={() => o.agent_id ? mark(o.id, "out_for_delivery") : setPickFor(o.id)} style={{ flex: 1, height: 40 }} testID={`send-out-${o.id}`} />
                  )}
                  {(o.status === "out_for_delivery" || (o.status !== "received" && o.status !== "packed" && o.status !== "delivered")) && (
                    <Button title={o.agent_id ? "Reassign" : "Assign Agent"} onPress={() => setPickFor(o.id)} style={{ flex: 1, height: 40 }} testID={`assign-${o.id}`} />
                  )}
                  {o.status !== "delivered" && o.status !== "received" && (
                    <Button title="Mark Delivered" variant="outline" onPress={() => mark(o.id, "delivered")} style={{ flex: 1, height: 40 }} testID={`mark-delivered-${o.id}`} />
                  )}
                </Row>

                <Row style={{ justifyContent: "flex-end", marginTop: spacing.sm }}>
                  <Txt size={type.sm} color={colors.brandPrimary} weight="semibold">View full details</Txt>
                  <ArrowRight size={14} color={colors.brandPrimary} style={{ marginLeft: 4 }} />
                </Row>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Agent picker modal */}
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

      {/* Date picker modal */}
      <DatePickerModal visible={showDatePicker} initial={deliveryDate} onClose={() => setShowDatePicker(false)} onPick={(d) => { setDeliveryDate(d); setShowDatePicker(false); }} />
    </View>
  );
}

function DatePickerModal({ visible, initial, onClose, onPick }: { visible: boolean; initial: string; onClose: () => void; onPick: (iso: string) => void }) {
  const [month, setMonth] = useState(() => initial ? new Date(initial + "T00:00:00") : new Date());
  const today = toISODate(new Date());
  const yesterday = toISODate(new Date(Date.now() - 86400000));

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startWeekday = monthStart.getDay();
  const grid: (number | null)[] = Array(startWeekday).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (grid.length % 7 !== 0) grid.push(null);
  const monthLabel = month.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const quickPick = (iso: string) => onPick(iso);
  const pickDay = (day: number) => {
    const d = new Date(month.getFullYear(), month.getMonth(), day);
    onPick(toISODate(d));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modal}>
          <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
            <Txt display weight="semibold" size={type.xl}>Pick a date</Txt>
            <Pressable onPress={onClose} hitSlop={10} testID="date-modal-close"><X size={22} color={colors.onSurface} /></Pressable>
          </Row>

          {/* Quick picks */}
          <Row style={{ gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.md }}>
            <Pressable onPress={() => quickPick(today)} style={styles.quickChip}><Txt weight="semibold" size={type.sm}>Today</Txt></Pressable>
            <Pressable onPress={() => quickPick(yesterday)} style={styles.quickChip}><Txt weight="semibold" size={type.sm}>Yesterday</Txt></Pressable>
            <Pressable onPress={() => onPick("")} style={styles.quickChip}><Txt weight="semibold" size={type.sm}>All dates</Txt></Pressable>
          </Row>

          {/* Month navigator */}
          <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.iconBtn} testID="cal-prev">
              <CaretLeft size={18} color={colors.onSurface} weight="bold" />
            </Pressable>
            <Txt display weight="semibold" size={type.lg}>{monthLabel}</Txt>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.iconBtn} testID="cal-next">
              <CaretRight size={18} color={colors.onSurface} weight="bold" />
            </Pressable>
          </Row>

          {/* Weekday header */}
          <Row style={{ marginBottom: spacing.xs }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <View key={i} style={styles.weekCell}><Txt size={type.sm} color={colors.muted}>{d}</Txt></View>
            ))}
          </Row>

          {/* Days grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {grid.map((day, idx) => {
              if (!day) return <View key={idx} style={styles.dayCell} />;
              const iso = toISODate(new Date(month.getFullYear(), month.getMonth(), day));
              const isToday = iso === today;
              const isSelected = iso === initial;
              return (
                <Pressable key={idx} onPress={() => pickDay(day)} style={[styles.dayCell, isSelected && styles.daySelected, isToday && !isSelected && styles.dayToday]} testID={`cal-day-${iso}`}>
                  <Txt weight={isToday || isSelected ? "semibold" : "regular"} color={isSelected ? colors.onBrandPrimary : isToday ? colors.brandPrimary : colors.onSurface}>
                    {day}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "85%" },
  agentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardSub: { borderColor: colors.brandPrimary, borderLeftWidth: 4, backgroundColor: "#FAFCF8" },
  subBanner: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandPrimary, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, alignSelf: "flex-start", marginBottom: spacing.sm },
  custRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  itemsBlock: { marginTop: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md },
  billRow: { marginTop: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md },
  meta: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },

  kindTabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  kindTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  kindTabOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  kindCount: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, minWidth: 22, alignItems: "center" },
  kindCountOn: { backgroundColor: colors.onBrandPrimary },

  dateBar: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, alignItems: "center" },
  dateBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6 },

  calBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },

  weekCell: { flex: 1, alignItems: "center", paddingVertical: 4 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  dayToday: { borderWidth: 1.5, borderColor: colors.brandPrimary },
  daySelected: { backgroundColor: colors.brandPrimary },

  quickChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
});
