import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wallet, Receipt, Tag, Headset, MapPin, SignOut, CaretRight, User } from "phosphor-react-native";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Card, Row, Badge } from "@/src/components/ui";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();

  useFocusEffect(useCallback(() => { refresh(); }, []));

  const menu = [
    { key: "addresses", label: "Manage Addresses", Icon: MapPin, route: "/addresses" },
    { key: "autopay", label: "AutoPay", Icon: Wallet, route: "/autopay" },
    { key: "billing", label: "Monthly Bill & Invoices", Icon: Receipt, route: "/billing" },
    { key: "coupons", label: "Coupons & Offers", Icon: Tag, route: "/coupons" },
    { key: "support", label: "Customer Support", Icon: Headset, route: "/support" },
  ];

  const defaultAddr = user?.addresses?.find((a: any) => a.id === user?.default_address_id) || user?.addresses?.[0];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing["3xl"] }}>
      <Txt display weight="semibold" size={type["2xl"]} style={{ paddingHorizontal: spacing.lg }}>Profile</Txt>

      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <User size={28} color={colors.onBrandPrimary} weight="fill" />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Txt display weight="semibold" size={type.xl}>{user?.name}</Txt>
          <Txt color={colors.muted}>+91 {user?.phone}</Txt>
          {!!user?.email && <Txt color={colors.muted} size={type.sm}>{user.email}</Txt>}
        </View>
      </Card>

      <Txt weight="semibold" color={colors.onSurfaceTertiary} style={styles.label}>Delivery Address</Txt>
      <Card style={{ marginHorizontal: spacing.lg }}>
        <Row>
          <MapPin size={20} color={colors.brandPrimary} weight="fill" />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Row style={{ gap: spacing.sm }}>
              <Txt weight="semibold">{defaultAddr?.label || "Home"}</Txt>
              <Badge label="Default" />
            </Row>
            <Txt color={colors.muted} size={type.sm} style={{ marginTop: 2 }}>
              {defaultAddr ? `${defaultAddr.flat}, ${defaultAddr.apartment}${defaultAddr.landmark ? ", " + defaultAddr.landmark : ""}` : "No address"}
            </Txt>
          </View>
        </Row>
      </Card>

      <Txt weight="semibold" color={colors.onSurfaceTertiary} style={styles.label}>Manage</Txt>
      <Card style={{ marginHorizontal: spacing.lg, padding: 0 }}>
        {menu.map((m, i) => (
          <Pressable key={m.key} testID={`menu-${m.key}`} onPress={() => router.push(m.route as any)} style={[styles.menuItem, i < menu.length - 1 && styles.menuBorder]}>
            <View style={styles.menuIcon}>
              <m.Icon size={20} color={colors.brandPrimary} weight="fill" />
            </View>
            <Txt weight="medium" style={{ flex: 1 }}>{m.label}</Txt>
            <CaretRight size={18} color={colors.muted} />
          </Pressable>
        ))}
      </Card>

      <Pressable testID="logout-button" onPress={signOut} style={styles.logout}>
        <SignOut size={20} color={colors.error} weight="fill" />
        <Txt weight="semibold" color={colors.error}>Log Out</Txt>
      </Pressable>
      <Txt color={colors.muted} size={type.sm} style={{ textAlign: "center", marginTop: spacing.md }}>DairyNest v1.0</Txt>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.lg, marginTop: spacing.lg },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  label: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  menuItem: { flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.md },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.xl, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.error },
});
