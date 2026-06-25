import { useRef, useState } from "react";
import { View, StyleSheet, useWindowDimensions, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { storage } from "@/src/utils/storage";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Button } from "@/src/components/ui";

const SLIDES = [
  {
    img: "https://images.unsplash.com/photo-1768850418252-37af725e46bb?w=900&q=80",
    title: "Fresh Milk Delivered Daily",
    sub: "Cow, Buffalo & A2 milk straight from the farm to your doorstep every morning.",
  },
  {
    img: "https://images.unsplash.com/photo-1659822887922-c1386185cc6b?w=900&q=80",
    title: "Organic Veggies & Fruits",
    sub: "Handpicked produce direct from trusted local farms, no middlemen.",
  },
  {
    img: "https://images.unsplash.com/photo-1440428099904-c6d459a7e7b5?w=900&q=80",
    title: "Morning & Evening Delivery",
    sub: "Flexible slots, easy checkout and full control over your subscriptions.",
  },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    await storage.setItem("dn_onboarded", true);
    router.replace("/login");
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1 });
      setIndex(index + 1);
    } else finish();
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <Image source={{ uri: item.img }} style={styles.img} contentFit="cover" transition={300} />
            <LinearGradient
              colors={["transparent", "rgba(44,66,48,0.55)", colors.surfaceInverse]}
              style={styles.scrim}
            />
          </View>
        )}
      />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Txt display weight="semibold" size={type["3xl"]} color={colors.onBrandPrimary}>
          {SLIDES[index].title}
        </Txt>
        <Txt size={type.lg} color={colors.brandSecondary} style={{ marginTop: spacing.sm, lineHeight: 24 }}>
          {SLIDES[index].sub}
        </Txt>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button title={index === SLIDES.length - 1 ? "Get Started" : "Next"} onPress={next} testID="onboarding-next-button" />
        <Pressable onPress={finish} style={{ alignItems: "center", marginTop: spacing.md }} testID="onboarding-skip-button">
          <Txt weight="medium" color={colors.brandSecondary}>
            Skip
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceInverse },
  img: { width: "100%", height: "100%", position: "absolute" },
  scrim: { ...StyleSheet.absoluteFillObject },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.xl },
  dots: { flexDirection: "row", gap: spacing.xs, marginVertical: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { width: 24, backgroundColor: colors.onBrandPrimary },
});
