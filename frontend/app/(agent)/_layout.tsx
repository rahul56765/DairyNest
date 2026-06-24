import { Tabs } from "expo-router";
import { Truck, Clock, ChartBar } from "phosphor-react-native";
import { colors, font } from "@/src/theme";

export default function AgentLayout() {
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
      <Tabs.Screen name="route" options={{ title: "Route", tabBarIcon: ({ color, focused }) => <Truck size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color, focused }) => <Clock size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="performance" options={{ title: "Performance", tabBarIcon: ({ color, focused }) => <ChartBar size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
    </Tabs>
  );
}
