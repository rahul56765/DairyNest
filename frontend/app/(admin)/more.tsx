import { useState } from "react";
import { View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, type } from "@/src/theme";
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
} from "@/src/components/management";

const TABS = ["Products", "Inventory", "Coupons", "Managers", "Agents", "Referrals", "AI", "Tickets"];

export default function AdminMore() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("Products");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md }}>
        <Txt display weight="semibold" size={type["2xl"]} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>Management</Txt>
        <ChipRow options={TABS} value={tab} onChange={setTab} testIDPrefix="admin-tab" />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}>
        {tab === "Products" && <ProductsTab />}
        {tab === "Inventory" && <InventoryTab />}
        {tab === "Coupons" && <CouponsTab />}
        {tab === "Managers" && <ManagersTab />}
        {tab === "Agents" && <AgentsTab />}
        {tab === "Referrals" && <ReferralsTab />}
        {tab === "AI" && <AITab />}
        {tab === "Tickets" && <TicketsTab />}
      </ScrollView>
    </View>
  );
}
