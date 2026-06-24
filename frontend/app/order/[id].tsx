import { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { CheckCircle, Circle, Package, Truck, House, Receipt } from "phosphor-react-native";
import { api } from "@/src/api";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Header, Card, Loading, Row, Badge } from "@/src/components/ui";

const ICONS: any = { received: Receipt, packed: Package, out_for_delivery: Truck, delivered: House };

export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    api.get(`/orders/${id}`).then(setOrder).catch(() => {});
  }, [id]);

  if (!order) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Order" back /><Loading /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={`Order #${order.id.slice(0, 8).toUpperCase()}`} back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}>
        <Card>
          <Txt display weight="semibold" size={type.lg} style={{ marginBottom: spacing.lg }}>Order Status</Txt>
          {order.tracking.map((t: any, i: number) => {
            const Icon = ICONS[t.step] || Circle;
            const last = i === order.tracking.length - 1;
            return (
              <Row key={t.step} style={{ alignItems: "flex-start" }}>
                <View style={{ alignItems: "center" }}>
                  <View style={[styles.dot, { backgroundColor: t.done ? colors.brandPrimary : colors.surfaceTertiary }]}>
                    <Icon size={18} color={t.done ? colors.onBrandPrimary : colors.muted} weight={t.done ? "fill" : "regular"} />
                  </View>
                  {!last && <View style={[styles.line, { backgroundColor: t.done ? colors.brandPrimary : colors.border }]} />}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md, paddingBottom: last ? 0 : spacing.lg }}>
                  <Txt weight={t.done ? "semibold" : "medium"} color={t.done ? colors.onSurface : colors.muted}>{t.label}</Txt>
                  {t.done && <Txt size={type.sm} color={colors.success}>Completed</Txt>}
                </View>
              </Row>
            );
          })}
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Row style={{ justifyContent: "space-between", marginBottom: spacing.sm }}>
            <Txt weight="semibold" size={type.lg}>Items</Txt>
            <Badge label={order.payment_status.replace(/_/g, " ")} color={order.payment_status === "paid" ? colors.success : colors.warning} bg={order.payment_status === "paid" ? "#E3F0E8" : "#FBEEDC"} />
          </Row>
          {order.items.map((it: any, i: number) => (
            <Row key={i} style={{ justifyContent: "space-between", paddingVertical: spacing.sm }}>
              <Txt color={colors.onSurfaceTertiary}>{it.qty} × {it.product.name}</Txt>
              <Txt weight="semibold">₹{it.line_total}</Txt>
            </Row>
          ))}
          <View style={styles.divider} />
          <Row style={{ justifyContent: "space-between" }}>
            <Txt weight="semibold" size={type.lg}>Total</Txt>
            <Txt display weight="semibold" size={type.lg} color={colors.brandPrimary}>₹{order.amount}</Txt>
          </Row>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt weight="semibold">Delivery</Txt>
          <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>{order.slot} slot · {order.delivery_date}</Txt>
          {order.address && <Txt color={colors.muted} size={type.sm}>{order.address.flat}, {order.address.apartment}</Txt>}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  line: { width: 2, flex: 1, minHeight: 28, marginVertical: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
});
