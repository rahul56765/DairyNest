import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { CaretLeft } from "phosphor-react-native";
import { colors, spacing, radius, font, type, shadow } from "@/src/theme";

export function Txt({
  children,
  style,
  weight = "regular",
  size = type.base,
  color = colors.onSurface,
  display = false,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
  weight?: "regular" | "medium" | "semibold" | "bold";
  size?: number;
  color?: string;
  display?: boolean;
  numberOfLines?: number;
}) {
  const fam = display
    ? weight === "regular"
      ? font.display
      : weight === "medium"
      ? font.displayMedium
      : font.displaySemi
    : font[weight];
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fam, fontSize: size, color }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  testID,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  icon?: React.ReactNode;
}) {
  const bg =
    variant === "primary"
      ? colors.brandPrimary
      : variant === "secondary"
      ? colors.brandSecondary
      : "transparent";
  const fg =
    variant === "primary"
      ? colors.onBrandPrimary
      : variant === "outline"
      ? colors.brandPrimary
      : colors.onBrandSecondary;
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "outline" && { borderWidth: 1.5, borderColor: colors.brandPrimary },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <Txt weight="semibold" size={type.lg} color={fg}>
            {title}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <View testID={testID} style={[styles.card, shadow.card, style]}>
      {children}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress && onPress();
      }}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
    >
      <Txt weight="medium" size={type.base} color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function ChipRow({
  options,
  value,
  onChange,
  testIDPrefix = "chip",
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  testIDPrefix?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
      style={styles.chipRow}
    >
      {options.map((o) => (
        <View key={o} style={{ flexShrink: 0, justifyContent: "center" }}>
          <Chip testID={`${testIDPrefix}-${o}`} label={o} active={value === o} onPress={() => onChange(o)} />
        </View>
      ))}
    </ScrollView>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  testIDPrefix = "seg",
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testIDPrefix}-${o.value}`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onChange(o.value);
            }}
            style={[styles.segItem, active && styles.segItemActive]}
          >
            <Txt weight={active ? "semibold" : "medium"} size={type.base} color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Header({
  title,
  back,
  right,
}: {
  title: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerRow}>
        {back ? (
          <Pressable testID="header-back-button" onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <CaretLeft size={22} color={colors.onSurface} weight="bold" />
          </Pressable>
        ) : (
          <View style={{ width: 38 }} />
        )}
        <Txt display weight="semibold" size={type.xl} style={{ flex: 1, textAlign: "center" }} numberOfLines={1}>
          {title}
        </Txt>
        <View style={{ width: 38, alignItems: "flex-end" }}>{right}</View>
      </View>
    </View>
  );
}

export function QtyStepper({
  qty,
  onChange,
  testID,
}: {
  qty: number;
  onChange: (q: number) => void;
  testID?: string;
}) {
  return (
    <View style={styles.stepper} testID={testID}>
      <Pressable testID={`${testID}-dec`} onPress={() => onChange(Math.max(0, qty - 1))} style={styles.stepBtn}>
        <Txt weight="bold" size={type.lg} color={colors.brandPrimary}>
          −
        </Txt>
      </Pressable>
      <Txt weight="semibold" size={type.base} style={{ minWidth: 22, textAlign: "center" }}>
        {qty}
      </Txt>
      <Pressable testID={`${testID}-inc`} onPress={() => onChange(qty + 1)} style={styles.stepBtn}>
        <Txt weight="bold" size={type.lg} color={colors.brandPrimary}>
          +
        </Txt>
      </Pressable>
    </View>
  );
}

export function Badge({ label, color = colors.success, bg = "#E3F0E8" }: { label: string; color?: string; bg?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Txt weight="semibold" size={type.sm} color={color}>
        {label}
      </Txt>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  cta,
  onCta,
  icon,
}: {
  title: string;
  subtitle?: string;
  cta?: string;
  onCta?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {icon}
      <Txt display weight="semibold" size={type.xl} style={{ marginTop: spacing.md, textAlign: "center" }}>
        {title}
      </Txt>
      {subtitle && (
        <Txt size={type.base} color={colors.muted} style={{ marginTop: spacing.xs, textAlign: "center" }}>
          {subtitle}
        </Txt>
      )}
      {cta && onCta && <Button title={cta} onPress={onCta} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.xl }} />}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipIdle: { backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  chipRow: { maxHeight: 56, paddingVertical: spacing.sm },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segItem: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segItemActive: { backgroundColor: colors.brandPrimary },
  header: {
    backgroundColor: colors.surface,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  backBtn: { width: 38, height: 38, alignItems: "flex-start", justifyContent: "center" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  stepBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, alignSelf: "flex-start" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
