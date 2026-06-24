import { useState } from "react";
import { View, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "@/src/api";
import { useAuth, homeRouteForRole } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, font } from "@/src/theme";
import { Txt, Button, Header } from "@/src/components/ui";

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  testID,
  optional,
}: any) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Txt weight="medium" size={type.sm} color={colors.onSurfaceTertiary} style={{ marginBottom: 6 }}>
        {label} {optional ? <Txt color={colors.muted} size={type.sm}>(optional)</Txt> : null}
      </Txt>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

export default function Register() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { signIn } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    apartment: "",
    flat: "",
    floor: "",
    landmark: "",
    referral_code: "",
  });
  const set = (k: string) => (v: string) => setForm({ ...form, [k]: v });

  const submit = async () => {
    if (!form.name.trim()) return toast.show("Please enter your name", "error");
    if (!form.apartment.trim() || !form.flat.trim()) return toast.show("Apartment & flat are required", "error");
    setLoading(true);
    try {
      const res = await api.post("/auth/register", { phone, role: "customer", ...form }, false);
      await signIn(res.token, res.user);
      toast.show(`Welcome to DairyNest, ${res.user.name.split(" ")[0]}!`, "success");
      router.replace(homeRouteForRole(res.user.role) as any);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Complete Profile" back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Txt color={colors.muted} style={{ marginBottom: spacing.lg }}>
            Tell us where to deliver your fresh milk & produce.
          </Txt>
          <Field label="Full Name" value={form.name} onChange={set("name")} placeholder="e.g. Neeraj Sharma" testID="reg-name" />
          <Field label="Email" value={form.email} onChange={set("email")} placeholder="you@email.com" keyboardType="email-address" testID="reg-email" optional />
          <Field label="Apartment / Society" value={form.apartment} onChange={set("apartment")} placeholder="e.g. Green Meadows" testID="reg-apartment" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Flat No." value={form.flat} onChange={set("flat")} placeholder="A-204" testID="reg-flat" />
            </View>
            <View style={{ width: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Field label="Floor" value={form.floor} onChange={set("floor")} placeholder="2" testID="reg-floor" optional />
            </View>
          </View>
          <Field label="Landmark" value={form.landmark} onChange={set("landmark")} placeholder="Near the park" testID="reg-landmark" optional />
          <Field label="Referral Code" value={form.referral_code} onChange={(v: string) => set("referral_code")(v.toUpperCase())} placeholder="e.g. NEERAJ100" testID="reg-referral" optional />

          <Button title="Create Account" onPress={submit} loading={loading} testID="register-submit-button" style={{ marginTop: spacing.md, marginBottom: spacing["2xl"] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    fontFamily: font.medium,
    fontSize: type.base,
    color: colors.onSurface,
  },
  row: { flexDirection: "row" },
});
