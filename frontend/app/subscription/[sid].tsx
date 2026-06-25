import { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { CaretLeft, CaretRight, X, CheckCircle, Clock, Calendar, Drop, Warning, ArrowRight } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Header, Loading, Row, Badge, Button } from "@/src/components/ui";

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const prettyDate = (iso: string) => {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
};

const STATUS_META: Record<string, { c: string; bg: string; label: string }> = {
  past_delivered: { c: colors.success, bg: "#E3F0E8", label: "Delivered" },
  past_failed:    { c: colors.error,   bg: "#F7E1E1", label: "Failed" },
  past_missed:    { c: colors.warning, bg: "#FBEEDC", label: "Missed" },
  today:          { c: colors.brandPrimary, bg: "#EAF1E6", label: "Today" },
  upcoming:       { c: colors.info,    bg: "#E4ECF6", label: "Upcoming" },
  skipped:        { c: colors.muted,   bg: colors.surfaceTertiary, label: "Skipped" },
  out_of_range:   { c: colors.muted,   bg: colors.surfaceTertiary, label: "" },
};

export default function SubscriptionDetail() {
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const router = useRouter();
  const toast = useToast();
  const [month, setMonth] = useState(() => new Date());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const load = useCallback(async () => {
    try {
      const from = toISODate(monthStart);
      const to = toISODate(monthEnd);
      const d = await api.get(`/subscriptions/${sid}/calendar?date_from=${from}&date_to=${to}`);
      setData(d);
    } catch (e: any) {
      toast.show(e?.message || "Failed to load", "error");
    }
    setLoading(false);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dayMap = useMemo(() => {
    const m: Record<string, any> = {};
    (data?.days || []).forEach((d: any) => { m[d.date] = d; });
    return m;
  }, [data]);

  if (loading || !data) return <Loading />;

  const sub = data.subscription || {};
  const daysInMonth = monthEnd.getDate();
  const startWeekday = monthStart.getDay();
  const grid: (number | null)[] = Array(startWeekday).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (grid.length % 7 !== 0) grid.push(null);
  const monthLabel = month.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const today = toISODate(new Date());

  const pause = async () => {
    setActionBusy("pause");
    try {
      await api.post(`/subscriptions/${sid}/${sub.status === "paused" ? "resume" : "pause"}`, {});
      toast.show(sub.status === "paused" ? "Resumed" : "Paused", "success");
      load();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setActionBusy(null); }
  };

  const skipTomorrow = async () => {
    setActionBusy("skip");
    try {
      await api.post(`/subscriptions/${sid}/skip-tomorrow`, {});
      toast.show("Tomorrow's delivery skipped", "success");
      load();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setActionBusy(null); }
  };

  const cancel = async () => {
    setActionBusy("cancel");
    try {
      await api.del(`/subscriptions/${sid}`);
      toast.show("Subscription cancelled", "info");
      router.back();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setActionBusy(null); }
  };

  const selectedData = selectedDay ? dayMap[selectedDay] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="My Subscription" back />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
      >
        {/* Plan summary */}
        <View style={styles.planCard}>
          <Row style={{ gap: spacing.sm, alignItems: "flex-start" }}>
            <View style={styles.planIcon}><Drop size={22} color={colors.brandPrimary} weight="fill" /></View>
            <View style={{ flex: 1 }}>
              <Txt display weight="semibold" size={type.lg}>{sub.milk_type}</Txt>
              <Txt color={colors.muted} size={type.sm}>
                {sub.quantity_label} · {sub.schedule} · {sub.frequency}
                {sub.commitment_days ? ` · ${sub.commitment_days}-day plan` : ""}
              </Txt>
              <Row style={{ gap: 6, marginTop: 4 }}>
                <Clock size={12} color={colors.brandPrimary} />
                <Txt size={type.sm} color={colors.brandPrimary}>
                  Expected window: {data.expected_time}
                </Txt>
              </Row>
            </View>
            <Badge
              label={sub.status === "active" ? "Active" : sub.status}
              color={sub.status === "active" ? colors.success : colors.warning}
              bg={sub.status === "active" ? "#E3F0E8" : "#FBEEDC"}
            />
          </Row>

          <Row style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Stat label="Delivered" value={data.delivered_count} icon={<CheckCircle size={16} color={colors.success} weight="fill" />} />
            <Stat label="Upcoming" value={data.upcoming_count} icon={<Calendar size={16} color={colors.brandPrimary} weight="fill" />} />
            <Stat label="₹/delivery" value={sub.price_per_delivery || 0} prefix="₹" />
          </Row>
        </View>

        {/* Month nav */}
        <View style={styles.head}>
          <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.iconBtn} testID="cust-cal-prev">
            <CaretLeft size={20} color={colors.onSurface} weight="bold" />
          </Pressable>
          <Txt display weight="semibold" size={type.xl}>{monthLabel}</Txt>
          <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.iconBtn} testID="cust-cal-next">
            <CaretRight size={20} color={colors.onSurface} weight="bold" />
          </Pressable>
        </View>

        {/* Weekday header */}
        <Row style={{ marginBottom: spacing.xs }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <View key={i} style={styles.weekCell}><Txt size={type.sm} color={colors.muted}>{d}</Txt></View>
          ))}
        </Row>

        {/* Calendar grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {grid.map((day, idx) => {
            if (!day) return <View key={idx} style={styles.dayCell} />;
            const iso = toISODate(new Date(month.getFullYear(), month.getMonth(), day));
            const info = dayMap[iso];
            const status = info?.status || "out_of_range";
            const meta = STATUS_META[status];
            const isToday = iso === today;
            const dotColor = ({
              past_delivered: colors.success,
              past_failed: colors.error,
              past_missed: colors.warning,
              today: colors.brandPrimary,
              upcoming: colors.info,
              skipped: colors.muted,
            } as Record<string, string>)[status];
            return (
              <Pressable
                key={idx}
                onPress={() => setSelectedDay(iso)}
                style={[styles.dayCell, isToday && styles.dayToday]}
                testID={`cust-day-${iso}`}
              >
                <Txt weight={isToday ? "semibold" : "regular"} color={isToday ? colors.brandPrimary : colors.onSurface}>{day}</Txt>
                {dotColor && status !== "out_of_range" && (
                  <View style={[styles.dot, { backgroundColor: dotColor }]} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Legend */}
        <View style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md }}>
          <Row style={{ gap: spacing.md, flexWrap: "wrap" }}>
            <LegendDot color={colors.success} label="Delivered" />
            <LegendDot color={colors.brandPrimary} label="Today" />
            <LegendDot color={colors.info} label="Upcoming" />
            <LegendDot color={colors.warning} label="Missed" />
            <LegendDot color={colors.error} label="Failed" />
            <LegendDot color={colors.muted} label="Skipped" />
          </Row>
        </View>

        {/* Subscription actions */}
        {sub.status !== "cancelled" && (
          <Row style={{ gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" }}>
            <Button
              title={sub.status === "paused" ? "Resume" : "Pause"}
              variant="outline"
              onPress={pause}
              loading={actionBusy === "pause"}
              style={{ flex: 1, minWidth: 100 }}
              testID="sub-pause"
            />
            <Button
              title="Skip tomorrow"
              variant="outline"
              onPress={skipTomorrow}
              loading={actionBusy === "skip"}
              style={{ flex: 1, minWidth: 110 }}
              testID="sub-skip"
            />
            <Button
              title="Cancel"
              variant="outline"
              onPress={cancel}
              loading={actionBusy === "cancel"}
              style={{ flex: 1, minWidth: 90, borderColor: colors.error }}
              testID="sub-cancel"
            />
          </Row>
        )}
      </ScrollView>

      {/* Day details modal */}
      <Modal visible={!!selectedDay} transparent animationType="slide" onRequestClose={() => setSelectedDay(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Txt display weight="semibold" size={type.xl}>
                  {selectedDay ? prettyDate(selectedDay) : ""}
                </Txt>
                {selectedData && STATUS_META[selectedData.status]?.label && (
                  <View style={{ marginTop: 6, alignSelf: "flex-start" }}>
                    <Badge label={STATUS_META[selectedData.status].label} color={STATUS_META[selectedData.status].c} bg={STATUS_META[selectedData.status].bg} />
                  </View>
                )}
              </View>
              <Pressable onPress={() => setSelectedDay(null)} hitSlop={10} testID="day-modal-close">
                <X size={22} color={colors.onSurface} />
              </Pressable>
            </Row>

            {!selectedData || selectedData.status === "out_of_range" ? (
              <View style={styles.emptyDay}>
                <Warning size={28} color={colors.muted} />
                <Txt color={colors.muted} style={{ marginTop: spacing.sm }}>No delivery scheduled on this day.</Txt>
              </View>
            ) : (
              <View>
                {selectedData.is_due && (
                  <View style={styles.detailRow}>
                    <Clock size={16} color={colors.brandPrimary} weight="fill" />
                    <View style={{ flex: 1 }}>
                      <Txt color={colors.muted} size={type.sm}>
                        {selectedData.actual_time ? "Delivered at" : "Expected window"}
                      </Txt>
                      <Txt weight="semibold">
                        {selectedData.actual_time ? new Date(selectedData.actual_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : selectedData.expected_time}
                      </Txt>
                    </View>
                  </View>
                )}
                {selectedData.is_due && (
                  <View style={styles.detailRow}>
                    <Drop size={16} color={colors.brandPrimary} weight="fill" />
                    <View style={{ flex: 1 }}>
                      <Txt color={colors.muted} size={type.sm}>Plan</Txt>
                      <Txt weight="semibold">{sub.milk_type} · {sub.quantity_label}</Txt>
                    </View>
                  </View>
                )}
                {selectedData.order_id && (
                  <Pressable onPress={() => { setSelectedDay(null); router.push(`/order/${selectedData.order_id}` as any); }} style={styles.linkRow} testID="sub-open-order">
                    <Txt weight="semibold" color={colors.brandPrimary}>View this delivery order</Txt>
                    <ArrowRight size={16} color={colors.brandPrimary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Stat({ label, value, icon, prefix }: { label: string; value: number; icon?: React.ReactNode; prefix?: string }) {
  return (
    <View style={styles.statBox}>
      <Row style={{ gap: 6, marginBottom: 2 }}>
        {icon}
        <Txt color={colors.muted} size={type.sm}>{label}</Txt>
      </Row>
      <Txt display weight="semibold" size={type.lg}>{prefix || ""}{value}</Txt>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Row style={{ gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Txt size={type.sm} color={colors.onSurfaceTertiary}>{label}</Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  planCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandSecondary, marginBottom: spacing.lg },
  planIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  statBox: { flex: 1, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md },

  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },

  weekCell: { flex: 1, alignItems: "center", paddingVertical: 4 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  dayToday: { borderWidth: 1.5, borderColor: colors.brandPrimary },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "85%" },
  emptyDay: { alignItems: "center", paddingVertical: spacing.xl },
  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, marginBottom: spacing.sm },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, marginTop: spacing.sm },
});
