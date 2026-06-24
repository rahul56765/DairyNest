import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { House, Drop, Receipt, Gift, User } from "phosphor-react-native";
import { colors, font } from "@/src/theme";

export default function CustomerLayout() {
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
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, focused }) => <House size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="subscription" options={{ title: "Subscription", tabBarIcon: ({ color, focused }) => <Drop size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, focused }) => <Receipt size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="rewards" options={{ title: "Rewards", tabBarIcon: ({ color, focused }) => <Gift size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, focused }) => <User size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
    </Tabs>
  );
}
