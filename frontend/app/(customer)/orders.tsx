import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Package, CaretRight, Drop, Calendar, CheckCircle, Clock, Repeat } from "phosphor-react-native";
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

type Tab = "active" | "past" | "subs";

export default function Orders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [orders, setOrders] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (tab === "subs") {
        const s = await api.get("/subscriptions");
        setSubs((s || []).filter((x: any) => x.status !== "cancelled"));
      } else {
        const o = await api.get(`/orders?status=${tab}`);
        setOrders(o);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderOrders = () => (
    orders.length === 0 ? (
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
          const isSub = !!o.subscription_id;
          return (
            <Pressable key={o.id} testID={`order-${o.id}`} onPress={() => router.push(`/order/${o.id}` as any)}>
              <Card style={{ marginBottom: spacing.md, ...(isSub ? { borderLeftWidth: 4, borderLeftColor: colors.brandPrimary } : {}) }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Row style={{ gap: 6, flex: 1 }}>
                    {isSub && <Repeat size={14} color={colors.brandPrimary} weight="bold" />}
                    <Txt weight="semibold">Order #{o.id.slice(0, 8).toUpperCase()}</Txt>
                  </Row>
                  <Badge label={o.status.replace(/_/g, " ")} color={sc.c} bg={sc.bg} />
                </Row>
                <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>
                  {o.items.length} item{o.items.length > 1 ? "s" : ""} · {o.slot} slot · {o.delivery_date}
                  {isSub ? " · from subscription" : ""}
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
    )
  );

  const renderSubs = () => (
    subs.length === 0 ? (
      <EmptyState
        icon={<Drop size={56} color={colors.borderStrong} />}
        title="No active subscriptions"
        subtitle="Start a weekly or monthly plan from any product page."
        cta="Browse milk"
        onCta={() => router.push("/catalog?type=milk")}
      />
    ) : (
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
      >
        {subs.map((s) => {
          const statusMeta = s.status === "active"
            ? { c: colors.success, bg: "#E3F0E8" }
            : { c: colors.warning, bg: "#FBEEDC" };
          return (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/subscription/${s.id}` as any)}
              testID={`sub-card-${s.id}`}
            >
              <Card style={[styles.subCard, { marginBottom: spacing.md }]}>
                <Row style={{ gap: spacing.sm, alignItems: "flex-start" }}>
                  <View style={styles.subIcon}><Drop size={22} color={colors.brandPrimary} weight="fill" /></View>
                  <View style={{ flex: 1 }}>
                    <Txt display weight="semibold" size={type.lg}>{s.milk_type}</Txt>
                    <Txt color={colors.muted} size={type.sm} style={{ marginTop: 2 }}>
                      {s.quantity_label} · {s.schedule} · {s.frequency}
                    </Txt>
                    <Row style={{ gap: 6, marginTop: 4 }}>
                      <Calendar size={11} color={colors.brandPrimary} />
                      <Txt size={type.sm} color={colors.brandPrimary}>
                        {s.commitment_days ? `${s.commitment_days}-day plan` : "Open-ended"}
                        {s.end_date ? ` · ends ${s.end_date}` : ""}
                      </Txt>
                    </Row>
                  </View>
                  <Badge label={s.status} color={statusMeta.c} bg={statusMeta.bg} />
                </Row>

                <Row style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <MiniStat icon={<CheckCircle size={14} color={colors.success} weight="fill" />} label="Per delivery" value={`₹${s.price_per_delivery || 0}`} />
                  <MiniStat icon={<Clock size={14} color={colors.brandPrimary} weight="fill" />} label="Schedule" value={s.schedule} />
                </Row>

                <Row style={{ justifyContent: "flex-end", marginTop: spacing.sm }}>
                  <Txt weight="semibold" size={type.sm} color={colors.brandPrimary}>View calendar</Txt>
                  <CaretRight size={16} color={colors.brandPrimary} />
                </Row>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    )
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface }}>
        <Txt display weight="semibold" size={type["2xl"]} style={{ marginBottom: spacing.md }}>My Orders</Txt>
        <Segmented
          options={[
            { label: "Active", value: "active" },
            { label: "Subscriptions", value: "subs" },
            { label: "Past", value: "past" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          testIDPrefix="orders-tab"
        />
      </View>
      {loading ? <Loading /> : tab === "subs" ? renderSubs() : renderOrders()}
    </View>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Row style={{ gap: 4, marginBottom: 2 }}>
        {icon}
        <Txt color={colors.muted} size={type.sm}>{label}</Txt>
      </Row>
      <Txt weight="semibold">{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  subCard: { backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary, borderWidth: 1 },
  subIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  miniStat: { flex: 1, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md },
});
