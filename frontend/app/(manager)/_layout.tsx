import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChartBar, Users, Receipt, DotsThreeOutline } from "phosphor-react-native";
import { useAuth } from "@/src/auth";
import { colors, font } from "@/src/theme";

export default function ManagerLayout() {
  const insets = useSafeAreaInsets();
  const pb = insets.bottom > 0 ? insets.bottom : 12;
  const { user } = useAuth();
  const p = (user as any)?.permissions || {};
  const moreVisible = p.products || p.inventory || p.marketing || p.support;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, height: 60 + pb, paddingTop: 8, paddingBottom: pb },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color, focused }) => <ChartBar size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="customers" options={{ title: "Customers", href: p.customers ? undefined : null, tabBarIcon: ({ color, focused }) => <Users size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", href: p.orders ? undefined : null, tabBarIcon: ({ color, focused }) => <Receipt size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="more" options={{ title: "More", href: moreVisible ? undefined : null, tabBarIcon: ({ color, focused }) => <DotsThreeOutline size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
    </Tabs>
  );
}
