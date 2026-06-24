import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Wallet, CalendarBlank, Sparkle } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, font } from "@/src/theme";
import { Txt, Header, Button, Card, Loading, Row, Chip, Badge } from "@/src/components/ui";

const APPS = ["Google Pay", "PhonePe", "Paytm", "BHIM"];

export default function AutoPay() {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [maxAmount, setMaxAmount] = useState("3000");
  const [app, setApp] = useState("Google Pay");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/autopay");
      setData(d);
      if (d.estimated_monthly) setMaxAmount(String(Math.max(3000, Math.ceil(d.estimated_monthly * 1.5))));
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="AutoPay" back /><Loading /></View>;

  const setup = async () => {
    setBusy(true);
    try {
      await api.post("/autopay/setup", { max_amount: parseFloat(maxAmount), app });
      toast.show("AutoPay mandate active!", "success");
      load();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };
  const action = async (path: string, msg: string) => {
    setBusy(true);
    try { await api.post(`/autopay/${path}`); toast.show(msg, "success"); load(); }
    catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };

  const m = data.mandate;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="AutoPay" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}>
        <Card style={styles.estCard}>
          <Row style={{ gap: spacing.sm }}>
            <Wallet size={20} color={colors.brandPrimary} weight="fill" />
            <Txt weight="semibold" color={colors.onBrandTertiary}>Estimated Monthly Bill</Txt>
          </Row>
          <Txt display weight="semibold" size={type["3xl"]} color={colors.brandPrimary} style={{ marginTop: spacing.sm }}>₹{data.estimated_monthly}</Txt>
          <Txt color={colors.muted} size={type.sm}>{data.active_subscriptions} active subscription(s)</Txt>
        </Card>

        {m ? (
          <>
            <LinearGradient colors={[colors.brandPrimary, colors.brand]} style={styles.mandate}>
              <Row style={{ justifyContent: "space-between" }}>
                <Row style={{ gap: spacing.sm }}><Wallet size={22} color={colors.onBrandPrimary} weight="fill" /><Txt weight="semibold" color={colors.onBrandPrimary}>{m.app}</Txt></Row>
                <Badge label={m.status} color={colors.surfaceInverse} bg={colors.brandSecondary} />
              </Row>
              <Txt color={colors.brandSecondary} style={{ marginTop: spacing.lg }}>Mandate Amount</Txt>
              <Txt display weight="semibold" size={type["2xl"]} color={colors.onBrandPrimary}>₹{m.max_amount}</Txt>
              <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <CalendarBlank size={16} color={colors.brandSecondary} />
                <Txt color={colors.brandSecondary} size={type.sm}>Next debit: {m.next_debit_date}</Txt>
              </Row>
              {m.simulated && <Txt color={colors.brandSecondary} size={type.sm} style={{ marginTop: spacing.sm }}>Mandate is SIMULATED in preview</Txt>}
            </LinearGradient>

            <Row style={{ gap: spacing.md, marginTop: spacing.lg }}>
              {m.status === "active" ? (
                <Button title="Pause AutoPay" variant="secondary" onPress={() => action("pause", "AutoPay paused")} style={{ flex: 1 }} testID="pause-autopay" />
              ) : (
                <Button title="Resume" onPress={() => action("resume", "AutoPay resumed")} style={{ flex: 1 }} testID="resume-autopay" />
              )}
              <Button title="Cancel" variant="outline" onPress={() => action("cancel", "Mandate cancelled")} style={{ flex: 1 }} testID="cancel-autopay" />
            </Row>
          </>
        ) : (
          <>
            <Txt display weight="semibold" size={type.lg} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Set up Mandate</Txt>
            <Txt color={colors.muted} size={type.sm} style={{ marginBottom: spacing.sm }}>Maximum monthly debit amount</Txt>
            <View style={styles.amountInput}>
              <Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>₹</Txt>
              <TextInput testID="mandate-amount" value={maxAmount} onChangeText={(t) => setMaxAmount(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" style={styles.amountText} />
            </View>
            <Txt color={colors.muted} size={type.sm} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Select UPI App</Txt>
            <Row style={{ gap: spacing.sm, flexWrap: "wrap" }}>
              {APPS.map((a) => <Chip key={a} testID={`upi-app-${a}`} label={a} active={app === a} onPress={() => setApp(a)} />)}
            </Row>
            <Button title="Create AutoPay Mandate" onPress={setup} loading={busy} testID="setup-autopay-button" style={{ marginTop: spacing.xl }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  estCard: { backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary },
  mandate: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  amountInput: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary },
  amountText: { flex: 1, height: 56, fontFamily: font.semibold, fontSize: type.xl, color: colors.onSurface },
});
