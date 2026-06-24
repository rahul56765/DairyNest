import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Truck, Clock, ChartBar } from "phosphor-react-native";
import { colors, font } from "@/src/theme";

export default function AgentLayout() {
  const insets = useSafeAreaInsets();
  const pb = insets.bottom > 0 ? insets.bottom : 12;
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
      <Tabs.Screen name="route" options={{ title: "Route", tabBarIcon: ({ color, focused }) => <Truck size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color, focused }) => <Clock size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="performance" options={{ title: "Performance", tabBarIcon: ({ color, focused }) => <ChartBar size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
    </Tabs>
  );
}
