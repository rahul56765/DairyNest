import { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Drop } from "phosphor-react-native";
import { api } from "@/src/api";
import { useAuth, homeRouteForRole } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, font } from "@/src/theme";
import { Txt, Button } from "@/src/components/ui";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const sendOtp = async () => {
    if (phone.length < 10) return toast.show("Enter a valid 10-digit number", "error");
    setLoading(true);
    try {
      const res = await api.post("/auth/send-otp", { phone }, false);
      setStep("otp");
      if (res.mode === "dev") {
        setDevCode(res.dev_code);
        toast.show("OTP sent (dev mode)", "info");
      } else toast.show("OTP sent to your phone", "success");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (otp.length < 4) return toast.show("Enter the OTP", "error");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", { phone, code: otp }, false);
      if (res.registered) {
        await signIn(res.token, res.user);
        router.replace(homeRouteForRole(res.user.role) as any);
      } else {
        router.replace({ pathname: "/register", params: { phone } } as any);
      }
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (p: string) => {
    setPhone(p);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.brandPrimary, colors.brand]} style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.logo}>
          <Drop size={40} color={colors.onBrandPrimary} weight="fill" />
        </View>
        <Txt display weight="semibold" size={type["3xl"]} color={colors.onBrandPrimary} style={{ marginTop: spacing.md }}>
          DairyNest
        </Txt>
        <Txt size={type.base} color={colors.brandSecondary} style={{ marginTop: 4 }}>
          Farm fresh, delivered daily.
        </Txt>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Txt display weight="semibold" size={type.xl}>
            {step === "phone" ? "Login or Sign up" : "Verify OTP"}
          </Txt>
          <Txt color={colors.muted} style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
            {step === "phone" ? "We'll send a one-time code to your mobile." : `Enter the code sent to +91 ${phone}`}
          </Txt>

          {step === "phone" ? (
            <>
              <View style={styles.phoneInput}>
                <Txt weight="semibold" size={type.lg} color={colors.onSurfaceTertiary}>
                  +91
                </Txt>
                <TextInput
                  testID="phone-input"
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, "").slice(0, 10))}
                  placeholder="Mobile number"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>
              <Button title="Send OTP" onPress={sendOtp} loading={loading} testID="send-otp-button" style={{ marginTop: spacing.lg }} />

              <Txt color={colors.muted} size={type.sm} style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
                Quick demo accounts
              </Txt>
              <View style={styles.demoRow}>
                {[
                  { label: "Customer", p: "9000000001" },
                  { label: "Agent", p: "9000000002" },
                  { label: "Admin", p: "6398213389" },
                ].map((d) => (
                  <Pressable key={d.p} testID={`demo-${d.label.toLowerCase()}`} onPress={() => quickFill(d.p)} style={styles.demoChip}>
                    <Txt weight="medium" size={type.sm} color={colors.brandPrimary}>
                      {d.label}
                    </Txt>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <TextInput
                testID="otp-input"
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="6-digit OTP"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={[styles.input, styles.otpInput]}
              />
              {devCode && (
                <Txt color={colors.info} size={type.sm} style={{ marginTop: spacing.sm }}>
                  Dev OTP: {devCode}
                </Txt>
              )}
              <Button title="Verify & Continue" onPress={verify} loading={loading} testID="verify-otp-button" style={{ marginTop: spacing.lg }} />
              <Pressable onPress={() => setStep("phone")} style={{ alignItems: "center", marginTop: spacing.md }}>
                <Txt weight="medium" color={colors.brandPrimary}>
                  Change number
                </Txt>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { paddingBottom: spacing.xl, alignItems: "center", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  logo: { width: 76, height: 76, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.xl },
  phoneInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  input: { flex: 1, height: 56, fontFamily: font.medium, fontSize: type.lg, color: colors.onSurface },
  otpInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    letterSpacing: 6,
  },
  demoRow: { flexDirection: "row", gap: spacing.sm },
  demoChip: {
    paddingHorizontal: spacing.lg,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
});
