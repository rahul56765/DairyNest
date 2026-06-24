import { useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Image, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { useAuth, homeRouteForRole } from "@/src/auth";
import { storage } from "@/src/utils/storage";
import { colors, spacing } from "@/src/theme";

const POSTER = require("@/assets/images/welcome-poster.png");
const { width, height } = Dimensions.get("window");

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    (async () => {
      if (user) {
        // For signed-in users, transition quickly to their home
        setTimeout(() => router.replace(homeRouteForRole(user.role) as any), 1100);
        return;
      }
      const seen = await storage.getItem("dn_onboarded", false);
      setTimeout(() => router.replace(seen ? "/login" : "/onboarding"), 1600);
    })();
  }, [loading, user]);

  return (
    <View style={styles.container} testID="welcome-transition">
      <Animated.View entering={FadeIn.duration(450)} style={StyleSheet.absoluteFill}>
        <Image
          source={POSTER}
          style={styles.poster}
          resizeMode="cover"
          // hint to the bundler that this is a critical above-the-fold asset
          fadeDuration={0}
        />
      </Animated.View>
      <View style={styles.indicatorWrap} pointerEvents="none">
        <ActivityIndicator color={colors.brandPrimary} size="small" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FCFAF8" },
  poster: { width, height },
  indicatorWrap: {
    position: "absolute",
    bottom: spacing["3xl"],
    left: 0,
    right: 0,
    alignItems: "center",
  },
});
