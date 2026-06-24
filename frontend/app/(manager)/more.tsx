import { useState, useMemo } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck, SignOut } from "phosphor-react-native";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, ChipRow, EmptyState } from "@/src/components/ui";
import {
  ProductsTab,
  InventoryTab,
  CouponsTab,
  ReferralsTab,
  TicketsTab,
  NotifyTab,
} from "@/src/components/management";

export default function ManagerMore() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const perms = user?.permissions || {};

  const tabs = useMemo(() => {
    const t: string[] = [];
    if (perms.products) t.push("Products");
    if (perms.inventory) t.push("Inventory");
    if (perms.marketing) { t.push("Coupons"); t.push("Notify"); t.push("Referrals"); }
    if (perms.support) t.push("Tickets");
    return t;
  }, [perms]);

  const [tab, setTab] = useState(tabs[0] || "");

  const Footer = (
    <>
      <View style={styles.account}>
        <Txt color={colors.muted} size={type.sm}>Signed in as</Txt>
        <Txt weight="semibold">{user?.name} (Manager)</Txt>
        <Txt color={colors.muted} size={type.sm}>+91 {user?.phone}</Txt>
      </View>
      <Pressable testID="manager-more-logout" onPress={signOut} style={styles.logout}>
        <SignOut size={20} color={colors.error} weight="fill" />
        <Txt weight="semibold" color={colors.error}>Log Out</Txt>
      </Pressable>
    </>
  );

  if (tabs.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + spacing.md }}>
        <Txt display weight="semibold" size={type["2xl"]} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>Management</Txt>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }}>
          <EmptyState
            title="No management permissions"
            subtitle="Ask your administrator to grant access to products, inventory, marketing or support."
            icon={<ShieldCheck size={64} color={colors.brandSecondary} weight="duotone" />}
          />
          {Footer}
        </ScrollView>
      </View>
    );
  }

  const activeTab = tabs.includes(tab) ? tab : tabs[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md }}>
        <Txt display weight="semibold" size={type["2xl"]} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>Management</Txt>
        <ChipRow options={tabs} value={activeTab} onChange={setTab} testIDPrefix="mgr-tab" />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}>
        {activeTab === "Products" && <ProductsTab />}
        {activeTab === "Inventory" && <InventoryTab />}
        {activeTab === "Coupons" && <CouponsTab />}
        {activeTab === "Notify" && <NotifyTab />}
        {activeTab === "Referrals" && <ReferralsTab />}
        {activeTab === "Tickets" && <TicketsTab />}
        {Footer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  account: { marginTop: spacing["2xl"], marginBottom: spacing.md, alignItems: "center", gap: 2 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.error },
});
