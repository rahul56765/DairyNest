import { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SignOut } from "phosphor-react-native";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, ChipRow } from "@/src/components/ui";
import {
  ProductsTab,
  InventoryTab,
  CouponsTab,
  ManagersTab,
  AgentsTab,
  ReferralsTab,
  AITab,
  TicketsTab,
  NotifyTab,
  SettingsTab,
  BannersTab,
} from "@/src/components/management";

const TABS = ["Products", "Banners", "Inventory", "Coupons", "Managers", "Agents", "Notify", "Settings", "Referrals", "AI", "Tickets"];

export default function AdminMore() {
  const insets = useSafeAreaInsets();
  const { signOut, user } = useAuth();
  const [tab, setTab] = useState("Products");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md }}>
        <Txt display weight="semibold" size={type["2xl"]} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>Management</Txt>
        <ChipRow options={TABS} value={tab} onChange={setTab} testIDPrefix="admin-tab" />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}>
        {tab === "Products" && <ProductsTab />}
        {tab === "Banners" && <BannersTab />}
        {tab === "Inventory" && <InventoryTab />}
        {tab === "Coupons" && <CouponsTab />}
        {tab === "Managers" && <ManagersTab />}
        {tab === "Agents" && <AgentsTab />}
        {tab === "Notify" && <NotifyTab />}
        {tab === "Settings" && <SettingsTab />}
        {tab === "Referrals" && <ReferralsTab />}
        {tab === "AI" && <AITab />}
        {tab === "Tickets" && <TicketsTab />}

        <View style={styles.account}>
          <Txt color={colors.muted} size={type.sm}>Signed in as</Txt>
          <Txt weight="semibold">{user?.name} (Super Admin)</Txt>
          <Txt color={colors.muted} size={type.sm}>+91 {user?.phone}</Txt>
        </View>
        <Pressable testID="admin-more-logout" onPress={signOut} style={styles.logout}>
          <SignOut size={20} color={colors.error} weight="fill" />
          <Txt weight="semibold" color={colors.error}>Log Out</Txt>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  account: { marginTop: spacing["2xl"], marginBottom: spacing.md, alignItems: "center", gap: 2 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.error },
});
