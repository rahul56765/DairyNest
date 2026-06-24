import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CheckCircle, WarningCircle, Info } from "phosphor-react-native";
import { colors, spacing, radius, font, type } from "@/src/theme";

type ToastType = "success" | "error" | "info";
const Ctx = createContext<{ show: (msg: string, type?: ToastType) => void }>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState("");
  const [tType, setTType] = useState<ToastType>("success");
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  const show = useCallback(
    (m: string, t: ToastType = "success") => {
      setMsg(m);
      setTType(t);
      setVisible(true);
      Haptics.notificationAsync(
        t === "error" ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
        ]).start(() => setVisible(false));
      }, 2600);
    },
    [opacity, translateY]
  );

  const Icon = tType === "success" ? CheckCircle : tType === "error" ? WarningCircle : Info;
  const accent = tType === "success" ? colors.success : tType === "error" ? colors.error : colors.info;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {visible && (
        <Animated.View
          pointerEvents="none"
          testID="toast"
          style={[styles.toast, { top: insets.top + spacing.sm, opacity, transform: [{ translateY }] }]}
        >
          <Icon size={22} color={accent} weight="fill" />
          <View style={{ flex: 1 }}>
            <Animated.Text style={styles.toastText}>{msg}</Animated.Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 9999,
  },
  toastText: { fontFamily: font.medium, fontSize: type.base, color: colors.onSurface },
});
