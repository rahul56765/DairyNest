import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Card, Loading, Row, Badge, Button } from "@/src/components/ui";

export default function AdminCustomers() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setCustomers(await api.get("/admin/customers")); } catch {}
    setLoading(false); setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (c: any) => {
    try {
      await api.put(`/admin/customers/${c.id}/${c.suspended ? "activate" : "suspend"}`);
      toast.show(c.suspended ? "Customer activated" : "Customer suspended", c.suspended ? "success" : "info");
      load();
    } catch (e: any) { toast.show(e.message, "error"); }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }}>
        <Txt display weight="semibold" size={type["2xl"]} style={{ marginBottom: spacing.sm }}>Customers</Txt>
        <Txt color={colors.muted} style={{ marginBottom: spacing.md }}>{customers.length} registered customers</Txt>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
      >
        {customers.map((c) => (
          <Card key={c.id} style={{ marginBottom: spacing.md }} testID={`customer-${c.id}`}>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Txt weight="semibold" size={type.lg}>{c.name}</Txt>
                <Txt color={colors.muted} size={type.sm}>+91 {c.phone}</Txt>
              </View>
              <Badge label={c.suspended ? "Suspended" : "Active"} color={c.suspended ? colors.error : colors.success} bg={c.suspended ? "#F6E4E4" : "#E3F0E8"} />
            </Row>
            <Row style={{ justifyContent: "space-between", marginTop: spacing.sm }}>
              <Txt color={colors.onSurfaceTertiary} size={type.sm}>{c.active_subscriptions} active sub(s) · Ref: {c.referral_code}</Txt>
            </Row>
            <Button
              title={c.suspended ? "Activate" : "Suspend"}
              variant={c.suspended ? "primary" : "outline"}
              onPress={() => toggle(c)}
              testID={`toggle-${c.id}`}
              style={{ marginTop: spacing.md, height: 42 }}
            />
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});
