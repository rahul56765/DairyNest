import { Tabs } from "expo-router";
import { ChartBar, Users, Receipt, DotsThreeOutline } from "phosphor-react-native";
import { colors, font } from "@/src/theme";

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, height: 84, paddingTop: 8, paddingBottom: 28 },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color, focused }) => <ChartBar size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="customers" options={{ title: "Customers", tabBarIcon: ({ color, focused }) => <Users size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, focused }) => <Receipt size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ color, focused }) => <DotsThreeOutline size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
    </Tabs>
  );
}
