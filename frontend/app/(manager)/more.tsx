import { useState, useMemo } from "react";
import { View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { colors, spacing, type } from "@/src/theme";
import { Txt, ChipRow, EmptyState } from "@/src/components/ui";
import { ShieldCheck } from "phosphor-react-native";
import {
  ProductsTab,
  InventoryTab,
  CouponsTab,
  ReferralsTab,
  TicketsTab,
} from "@/src/components/management";

export default function ManagerMore() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const perms = user?.permissions || {};

  // Build tab list dynamically based on permissions
  const tabs = useMemo(() => {
    const t: string[] = [];
    if (perms.products) t.push("Products");
    if (perms.inventory) t.push("Inventory");
    if (perms.marketing) { t.push("Coupons"); t.push("Referrals"); }
    if (perms.support) t.push("Tickets");
    return t;
  }, [perms]);

  const [tab, setTab] = useState(tabs[0] || "");

  // No permissions at all
  if (tabs.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + spacing.md }}>
        <Txt display weight="semibold" size={type["2xl"]} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>Management</Txt>
        <EmptyState
          title="No management permissions"
          subtitle="Ask your administrator to grant access to products, inventory, marketing or support."
          icon={<ShieldCheck size={64} color={colors.brandSecondary} weight="duotone" />}
        />
      </View>
    );
  }

  // If selected tab is no longer in list (e.g. perms changed), reset
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
        {activeTab === "Referrals" && <ReferralsTab />}
        {activeTab === "Tickets" && <TicketsTab />}
      </ScrollView>
    </View>
  );
}
