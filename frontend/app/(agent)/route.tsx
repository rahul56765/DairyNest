import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MapPin, Phone, Check, WarningOctagon, SignOut, Buildings, NavigationArrow } from "phosphor-react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Card, Loading, Row, Badge, EmptyState, Button } from "@/src/components/ui";

// Build a Google Maps URL — prefer lat/lng, fall back to address text query
function buildMapsUrl(addr: any): string | null {
  if (!addr) return null;
  if (typeof addr.lat === "number" && typeof addr.lng === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${addr.lat},${addr.lng}`;
  }
  const parts = [addr.flat, addr.apartment, addr.landmark, addr.area_name, addr.area, addr.city, addr.pincode]
    .filter(Boolean)
    .join(", ");
  if (!parts) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

// Normalise phone for tel: link
function telUri(phone?: string): string | null {
  if (!phone) return null;
  const clean = String(phone).replace(/[^0-9+]/g, "");
  if (!clean) return null;
  // Prepend +91 if it looks like a 10-digit Indian number
  const e164 = clean.startsWith("+") ? clean : (clean.length === 10 ? `+91${clean}` : `+${clean}`);
  return `tel:${e164}`;
}

export default function AgentRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [summary, setSummary] = useState<any>(null);
  const [route, setRoute] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.get("/agent/summary"), api.get("/agent/route")]);
      setSummary(s);
      setRoute(r);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mark = async (oid: string, status: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    try {
      await api.post(`/agent/delivery/${oid}/status`, { status });
      toast.show(status === "delivered" ? "Marked delivered" : "Marked as failed", status === "delivered" ? "success" : "info");
      load();
    } catch (e: any) { toast.show(e.message, "error"); }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.head, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Txt color={colors.brandSecondary} size={type.sm}>Today's Route</Txt>
          <Txt display weight="semibold" size={type.xl} color={colors.onBrandPrimary}>{user?.name?.split(" ")[0]}</Txt>
        </View>
        <Pressable testID="agent-logout" onPress={signOut} hitSlop={10}><SignOut size={22} color={colors.onBrandPrimary} /></Pressable>
      </View>

      <View style={styles.summaryRow}>
        <Stat label="Total" value={summary?.total || 0} color={colors.onSurface} />
        <Stat label="Delivered" value={summary?.delivered || 0} color={colors.success} />
        <Stat label="Pending" value={summary?.pending || 0} color={colors.warning} />
        <Stat label="Failed" value={summary?.failed || 0} color={colors.error} />
      </View>

      {route.length === 0 ? (
        <EmptyState icon={<Buildings size={56} color={colors.borderStrong} />} title="No deliveries assigned" subtitle="Your route for today is empty." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        >
          {route.map((group) => (
            <View key={group.apartment} style={{ marginBottom: spacing.lg }}>
              <Row style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
                <Buildings size={18} color={colors.brandPrimary} weight="fill" />
                <Txt display weight="semibold" size={type.lg}>{group.apartment}</Txt>
                <Badge label={`${group.stops.length} stops`} />
              </Row>
              {group.stops.map((o: any) => {
                const done = o.status === "delivered";
                const failed = o.status === "failed";
                const mapsUrl = buildMapsUrl(o.address);
                const callUri = telUri(o.customer?.phone);
                const openMaps = () => {
                  if (!mapsUrl) { toast.show("No location available", "info"); return; }
                  Linking.openURL(mapsUrl).catch(() => toast.show("Couldn't open Maps", "error"));
                };
                const callCustomer = () => {
                  if (!callUri) { toast.show("Phone number not available", "info"); return; }
                  Linking.openURL(callUri).catch(() => toast.show("Couldn't open dialer", "error"));
                };
                return (
                  <Card key={o.id} style={{ marginBottom: spacing.md }} testID={`delivery-${o.id}`}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <Txt weight="semibold" size={type.lg}>{o.address?.flat || "—"}</Txt>
                        <Txt color={colors.muted} size={type.sm}>{o.items.length} item(s) · {o.slot} slot</Txt>
                      </View>
                      {(done || failed) && <Badge label={done ? "Delivered" : "Failed"} color={done ? colors.success : colors.error} bg={done ? "#E3F0E8" : "#F6E4E4"} />}
                    </Row>

                    {/* Customer block */}
                    <Pressable onPress={callCustomer} style={styles.custBlock} testID={`cust-${o.id}`}>
                      <View style={{ flex: 1 }}>
                        <Txt weight="semibold" size={type.base}>{o.customer?.name || "Customer"}</Txt>
                        {!!o.customer?.phone && (
                          <Row style={{ gap: 4, marginTop: 2 }}>
                            <Phone size={12} color={colors.brandPrimary} weight="fill" />
                            <Txt size={type.sm} color={colors.brandPrimary} weight="medium">+91 {o.customer.phone}</Txt>
                          </Row>
                        )}
                      </View>
                      {!!callUri && (
                        <View style={styles.callPill}>
                          <Phone size={14} color={colors.onBrandPrimary} weight="bold" />
                          <Txt color={colors.onBrandPrimary} weight="semibold" size={type.sm} style={{ marginLeft: 4 }}>Call</Txt>
                        </View>
                      )}
                    </Pressable>

                    {/* Address + Maps */}
                    <Pressable onPress={openMaps} style={styles.addrBlock} testID={`maps-${o.id}`}>
                      <MapPin size={16} color={colors.brandPrimary} weight="fill" />
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Txt size={type.sm} color={colors.onSurface} numberOfLines={2}>
                          {[o.address?.flat, o.address?.apartment, o.address?.area_name || o.address?.area, o.address?.city]
                            .filter(Boolean).join(", ") || "No address"}
                        </Txt>
                        {!!o.address?.landmark && (
                          <Txt size={type.sm} color={colors.muted} numberOfLines={1}>Landmark: {o.address.landmark}</Txt>
                        )}
                      </View>
                      <Row style={styles.mapsPill}>
                        <NavigationArrow size={14} color={colors.onBrandPrimary} weight="fill" />
                        <Txt color={colors.onBrandPrimary} weight="semibold" size={type.sm} style={{ marginLeft: 4 }}>Map</Txt>
                      </Row>
                    </Pressable>

                    <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                      {o.items.slice(0, 3).map((it: any, i: number) => (
                        <Txt key={i} size={type.sm} color={colors.onSurfaceTertiary}>{it.qty}× {it.product.name}{i < Math.min(o.items.length, 3) - 1 ? "," : ""}</Txt>
                      ))}
                    </Row>
                    {!done && !failed && (
                      <Row style={{ gap: spacing.md, marginTop: spacing.md }}>
                        <Button title="Delivered" onPress={() => mark(o.id, "delivered")} style={{ flex: 1 }} testID={`deliver-${o.id}`} icon={<Check size={18} color={colors.onBrandPrimary} weight="bold" />} />
                        <Button title="Failed" variant="outline" onPress={() => mark(o.id, "not_delivered")} style={{ flex: 1 }} testID={`fail-${o.id}`} />
                      </Row>
                    )}
                    <Row style={{ gap: spacing.md, marginTop: spacing.sm, justifyContent: "flex-end" }}>
                      <Pressable testID={`call-${o.id}`} onPress={callCustomer} style={styles.iconBtn}><Phone size={18} color={colors.brandPrimary} weight="fill" /></Pressable>
                      <Pressable testID={`navigate-${o.id}`} onPress={openMaps} style={styles.iconBtn}><NavigationArrow size={18} color={colors.brandPrimary} weight="fill" /></Pressable>
                      <Pressable testID={`issue-${o.id}`} onPress={() => api.post("/agent/issue", { order_id: o.id, category: "Customer Not Available", note: "" }).then(() => toast.show("Issue reported", "info"))} style={styles.iconBtn}><WarningOctagon size={18} color={colors.warning} weight="fill" /></Pressable>
                    </Row>
                  </Card>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <View style={styles.stat}>
      <Txt display weight="semibold" size={type.xl} color={color}>{value}</Txt>
      <Txt size={type.sm} color={colors.muted}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  summaryRow: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, marginHorizontal: spacing.lg, marginTop: -spacing.lg, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  stat: { flex: 1, alignItems: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  custBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  callPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  addrBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  mapsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
});
