import { useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Drop } from "phosphor-react-native";
import { useAuth, homeRouteForRole } from "@/src/auth";
import { storage } from "@/src/utils/storage";
import { colors, font, type, spacing } from "@/src/theme";
import { Txt } from "@/src/components/ui";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    (async () => {
      if (user) {
        router.replace(homeRouteForRole(user.role) as any);
        return;
      }
      const seen = await storage.getItem("dn_onboarded", false);
      setTimeout(() => router.replace(seen ? "/login" : "/onboarding"), 900);
    })();
  }, [loading, user]);

  return (
    <LinearGradient colors={[colors.brandPrimary, colors.brand]} style={styles.container}>
      <View style={styles.logo}>
        <Drop size={48} color={colors.onBrandPrimary} weight="fill" />
      </View>
      <Txt display weight="semibold" size={type["3xl"]} color={colors.onBrandPrimary} style={{ marginTop: spacing.lg }}>
        DairyNest
      </Txt>
      <Txt size={type.lg} color={colors.brandSecondary} style={{ marginTop: spacing.xs }}>
        Farm fresh, delivered daily.
      </Txt>
      <ActivityIndicator color={colors.onBrandPrimary} style={{ marginTop: spacing["2xl"] }} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
