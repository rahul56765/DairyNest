import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkle } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, type } from "@/src/theme";
import { Txt, Card, Loading, Row, Badge, Button, ChipRow } from "@/src/components/ui";

const TABS = ["Products", "Inventory", "Referrals", "AI", "Tickets"];

export default function AdminMore() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [tab, setTab] = useState("Products");
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [ai, setAi] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "Products") setProducts(await api.get("/admin/products"));
      else if (tab === "Inventory") setInventory(await api.get("/admin/inventory"));
      else if (tab === "Referrals") setReferrals(await api.get("/admin/referrals"));
      else if (tab === "AI") setAi(await api.get("/admin/ai-predictions"));
      else if (tab === "Tickets") setTickets(await api.get("/admin/tickets"));
    } catch {}
    setLoading(false);
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const disableProduct = async (id: string) => {
    await api.del(`/admin/products/${id}`);
    toast.show("Product disabled", "info");
    load();
  };
  const resolveTicket = async (id: string) => {
    await api.put(`/admin/tickets/${id}/status?status=resolved`);
    toast.show("Ticket resolved", "success");
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md }}>
        <Txt display weight="semibold" size={type["2xl"]} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>Management</Txt>
        <ChipRow options={TABS} value={tab} onChange={setTab} testIDPrefix="admin-tab" />
      </View>
      {loading ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}>
          {tab === "Products" && products.map((p) => (
            <Card key={p.id} style={{ marginBottom: spacing.md }}>
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Txt weight="semibold">{p.name}</Txt>
                  <Txt color={colors.muted} size={type.sm}>{p.category} · ₹{p.price} · stock {p.stock}</Txt>
                </View>
                <Badge label={p.active ? "Active" : "Disabled"} color={p.active ? colors.success : colors.muted} bg={p.active ? "#E3F0E8" : colors.surfaceTertiary} />
              </Row>
              {p.active && <Button title="Disable" variant="outline" onPress={() => disableProduct(p.id)} style={{ marginTop: spacing.sm, height: 38 }} testID={`disable-${p.id}`} />}
            </Card>
          ))}

          {tab === "Inventory" && inventory && (
            <>
              {inventory.low_stock.length > 0 && (
                <Card style={{ marginBottom: spacing.md, backgroundColor: "#FBEEDC", borderColor: colors.warning }}>
                  <Txt weight="semibold" color={colors.warning}>⚠ {inventory.low_stock.length} items low on stock</Txt>
                </Card>
              )}
              {inventory.items.map((it: any) => (
                <Card key={it.id} style={{ marginBottom: spacing.sm }}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt weight="medium">{it.name}</Txt>
                    <Txt display weight="semibold" color={it.stock < 20 ? colors.error : colors.brandPrimary}>{it.stock}</Txt>
                  </Row>
                </Card>
              ))}
            </>
          )}

          {tab === "Referrals" && referrals.map((r) => (
            <Card key={r.code} style={{ marginBottom: spacing.md }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt display weight="semibold">{r.code}</Txt>
                <Badge label={`₹${r.reward_amount} earned`} />
              </Row>
              <Row style={{ justifyContent: "space-between", marginTop: spacing.sm }}>
                <Txt color={colors.muted} size={type.sm}>Signups: {r.signups}</Txt>
                <Txt color={colors.muted} size={type.sm}>Paid: {r.paid_orders}</Txt>
              </Row>
            </Card>
          ))}

          {tab === "AI" && ai && (
            <Card style={{ backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary }}>
              <Row style={{ gap: spacing.sm }}><Sparkle size={20} color={colors.brandPrimary} weight="fill" /><Txt display weight="semibold" size={type.lg}>Demand Forecast</Txt></Row>
              <Txt color={colors.onSurfaceTertiary} style={{ marginTop: spacing.md, lineHeight: 22 }}>{ai.forecast}</Txt>
              <Row style={{ gap: spacing.xl, marginTop: spacing.lg }}>
                <View><Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>{ai.customers}</Txt><Txt size={type.sm} color={colors.muted}>Customers</Txt></View>
                <View><Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>{ai.active_subscriptions}</Txt><Txt size={type.sm} color={colors.muted}>Active subs</Txt></View>
              </Row>
            </Card>
          )}

          {tab === "Tickets" && (tickets.length === 0 ? <Txt color={colors.muted}>No tickets.</Txt> : tickets.map((t) => (
            <Card key={t.id} style={{ marginBottom: spacing.md }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt weight="semibold" style={{ flex: 1 }}>{t.subject}</Txt>
                <Badge label={t.status} color={t.status === "resolved" ? colors.success : colors.warning} bg={t.status === "resolved" ? "#E3F0E8" : "#FBEEDC"} />
              </Row>
              <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>{t.user_name} · {t.category}</Txt>
              <Txt color={colors.onSurfaceTertiary} size={type.sm} style={{ marginTop: spacing.sm }}>{t.message}</Txt>
              {t.status !== "resolved" && <Button title="Resolve" onPress={() => resolveTicket(t.id)} style={{ marginTop: spacing.sm, height: 38 }} testID={`resolve-${t.id}`} />}
            </Card>
          )))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({});
