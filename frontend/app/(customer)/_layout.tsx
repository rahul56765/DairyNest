import { Tabs } from "expo-router";
import { House, Drop, Receipt, Gift, User } from "phosphor-react-native";
import { colors, font } from "@/src/theme";

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          height: 84,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: ({ color, focused }) => <House size={24} color={color} weight={focused ? "fill" : "regular"} /> }}
      />
      <Tabs.Screen
        name="subscription"
        options={{ title: "Subscription", tabBarIcon: ({ color, focused }) => <Drop size={24} color={color} weight={focused ? "fill" : "regular"} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "Orders", tabBarIcon: ({ color, focused }) => <Receipt size={24} color={color} weight={focused ? "fill" : "regular"} /> }}
      />
      <Tabs.Screen
        name="rewards"
        options={{ title: "Rewards", tabBarIcon: ({ color, focused }) => <Gift size={24} color={color} weight={focused ? "fill" : "regular"} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, focused }) => <User size={24} color={color} weight={focused ? "fill" : "regular"} /> }}
      />
    </Tabs>
  );
}
