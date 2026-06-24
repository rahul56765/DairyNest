import { Image, View, StyleSheet, ImageStyle, StyleProp } from "react-native";

const LOGO = require("@/assets/images/dairynest-logo.png");

/**
 * Small DairyNest brand mark. The logo PNG has a white background;
 * by default we render it inside a rounded square container with white
 * background so it blends naturally with cream/cream surfaces without
 * showing a hard rectangular edge.
 */
export function BrandMark({ size = 40, plain = false, style }: { size?: number; plain?: boolean; style?: StyleProp<ImageStyle> }) {
  if (plain) {
    return <Image source={LOGO} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
  }
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size * 0.28 },
      ]}
    >
      <Image source={LOGO} style={{ width: size * 1.05, height: size * 1.05 }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
