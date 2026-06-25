import { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, Linking, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { CaretLeft, CaretRight, X, Phone, UserCircle, ArrowsClockwise, Drop } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Loading, Row, Badge, Button, Header } from "@/src/components/ui";

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

export default function SubscriptionCalendar() {
  const toast = useToast();
  const [month, setMonth] = useState(() => new Date());
  const [data, setData] = useState<{ dates: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const load = useCallback(async () => {
    try {
      const from = toISODate(monthStart);
      const to = toISODate(monthEnd);
      const d = await api.get(`/admin/subscriptions/calendar?date_from=${from}&date_to=${to}`);
      setData(d);
    } catch (e: any) {
      toast.show(e?.message || "Failed to load", "error");
    }
    setLoading(false);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dayMap = useMemo(() => {
    const m: Record<string, any> = {};
    (data?.dates || []).forEach((d) => { m[d.date] = d; });
    return m;
  }, [data]);

  const daysInMonth = monthEnd.getDate();
  const startWeekday = monthStart.getDay();
  const grid: (number | null)[] = Array(startWeekday).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (grid.length % 7 !== 0) grid.push(null);

  const monthLabel = month.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const today = toISODate(new Date());

  const totalThisMonth = useMemo(() => (data?.dates || []).reduce((acc: number, d: any) => acc + (d.count || 0), 0), [data]);

  const callCustomer = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:+91${phone}`).catch(() => {});
  };

  const generateForDay = async (iso: string) => {
    setGenerating(true);
    try {
      const r = await api.post(`/admin/subscriptions/generate-daily?date_str=${iso}`, {});
      toast.show(`Created ${r.created} order(s) for ${iso} (skipped ${r.skipped})`, "success");
    } catch (e: any) { toast.show(e.message, "error"); } finally { setGenerating(false); }
  };

  if (loading) return <Loading />;

  const selectedData = selectedDay ? dayMap[selectedDay] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Subscription Calendar" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
      >
        {/* Month nav */}
        <View style={styles.head}>
          <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.iconBtn} testID="sub-cal-prev">
            <CaretLeft size={20} color={colors.onSurface} weight="bold" />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Txt display weight="semibold" size={type.xl}>{monthLabel}</Txt>
            <Txt color={colors.muted} size={type.sm} style={{ marginTop: 2 }}>
              {totalThisMonth} expected delivery{totalThisMonth === 1 ? "" : "ies"} this month
            </Txt>
          </View>
          <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.iconBtn} testID="sub-cal-next">
            <CaretRight size={20} color={colors.onSurface} weight="bold" />
          </Pressable>
        </View>

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
            const info = dayMap[iso];
            const count = info?.count || 0;
            const isToday = iso === today;
            return (
              <Pressable
                key={idx}
                onPress={() => setSelectedDay(iso)}
                style={[styles.dayCell, count > 0 && styles.dayHas, isToday && styles.dayToday]}
                testID={`sub-cal-day-${iso}`}
              >
                <Txt weight={isToday ? "semibold" : "regular"} color={isToday ? colors.brandPrimary : colors.onSurface}>{day}</Txt>
                {count > 0 && (
                  <View style={styles.dayBadge}>
                    <Txt size={type.xs} weight="semibold" color={colors.onBrandPrimary}>{count}</Txt>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Legend */}
        <Row style={{ gap: spacing.md, marginTop: spacing.lg, flexWrap: "wrap" }}>
          <Row style={{ gap: 6 }}>
            <View style={[styles.legendDot, { backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary }]} />
            <Txt size={type.sm} color={colors.muted}>Has deliveries</Txt>
          </Row>
          <Row style={{ gap: 6 }}>
            <View style={[styles.legendDot, { borderColor: colors.brandPrimary, borderWidth: 1.5 }]} />
            <Txt size={type.sm} color={colors.muted}>Today</Txt>
          </Row>
        </Row>
      </ScrollView>

      {/* Day details modal */}
      <Modal visible={!!selectedDay} transparent animationType="slide" onRequestClose={() => setSelectedDay(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Txt display weight="semibold" size={type.xl}>{selectedDay ? prettyDate(selectedDay) : ""}</Txt>
                <Txt color={colors.muted} size={type.sm}>
                  {selectedData ? `${selectedData.count} subscription delivery${selectedData.count === 1 ? "" : "ies"} expected` : "No deliveries"}
                </Txt>
              </View>
              <Pressable onPress={() => setSelectedDay(null)} hitSlop={10} testID="day-modal-close">
                <X size={22} color={colors.onSurface} />
              </Pressable>
            </Row>

            <Button
              title={generating ? "Creating orders…" : "Generate Orders for this Day"}
              icon={<ArrowsClockwise size={16} color={colors.onBrandPrimary} weight="bold" />}
              onPress={() => selectedDay && generateForDay(selectedDay)}
              loading={generating}
              style={{ marginBottom: spacing.md }}
              testID="generate-day-orders"
            />

            <ScrollView style={{ maxHeight: 420 }}>
              {(!selectedData || selectedData.deliveries.length === 0) && (
                <Txt color={colors.muted} style={{ textAlign: "center", paddingVertical: spacing.lg }}>
                  No subscription deliveries on this day.
                </Txt>
              )}
              {(selectedData?.deliveries || []).map((dlv: any, i: number) => (
                <View key={i} style={styles.deliveryCard}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Row style={{ gap: spacing.sm, flex: 1 }}>
                      <View style={styles.avatar}><Drop size={20} color={colors.brandPrimary} weight="fill" /></View>
                      <View style={{ flex: 1 }}>
                        <Txt weight="semibold">{dlv.milk_type || "Milk"} · {dlv.quantity_label || "1L"}</Txt>
                        <Txt color={colors.muted} size={type.sm}>{dlv.schedule} · {dlv.frequency}</Txt>
                      </View>
                    </Row>
                    <Badge label={`₹${dlv.price_per_delivery ?? 0}`} />
                  </Row>
                  <Pressable onPress={() => callCustomer(dlv.phone)} style={styles.custRow}>
                    <UserCircle size={20} color={colors.brandPrimary} weight="fill" />
                    <View style={{ flex: 1 }}>
                      <Txt weight="medium" size={type.sm}>{dlv.name}</Txt>
                      <Row style={{ gap: 4, marginTop: 2 }}>
                        <Phone size={11} color={colors.muted} />
                        <Txt color={colors.muted} size={type.sm}>+91 {dlv.phone || "—"}</Txt>
                      </Row>
                    </View>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "85%" },

  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },

  weekCell: { flex: 1, alignItems: "center", paddingVertical: 4 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, padding: 2 },
  dayHas: { backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandSecondary },
  dayToday: { borderWidth: 1.5, borderColor: colors.brandPrimary },
  dayBadge: { position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },

  legendDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },

  deliveryCard: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  custRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
