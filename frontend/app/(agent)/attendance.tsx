import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Clock, SignIn, SignOut } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Card, Button, Row, Badge } from "@/src/components/ui";

export default function Attendance() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [rec, setRec] = useState<any>(null);

  const load = useCallback(async () => {
    try { setRec(await api.get("/agent/attendance/today")); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
  const hours = rec?.check_in && rec?.check_out ? ((new Date(rec.check_out).getTime() - new Date(rec.check_in).getTime()) / 3.6e6).toFixed(1) : null;

  const checkIn = async () => { await api.post("/agent/attendance/checkin"); toast.show("Checked in!", "success"); load(); };
  const checkOut = async () => { await api.post("/agent/attendance/checkout"); toast.show("Checked out!", "success"); load(); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, padding: spacing.lg }}>
      <Txt display weight="semibold" size={type["2xl"]} style={{ marginBottom: spacing.lg }}>Attendance</Txt>

      <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
        <View style={styles.clockBox}><Clock size={40} color={colors.brandPrimary} weight="fill" /></View>
        <Txt color={colors.muted} style={{ marginTop: spacing.md }}>{new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</Txt>
        <Row style={{ gap: spacing.xl, marginTop: spacing.lg }}>
          <View style={{ alignItems: "center" }}>
            <Txt size={type.sm} color={colors.muted}>Check In</Txt>
            <Txt display weight="semibold" size={type.xl} color={colors.success}>{fmt(rec?.check_in)}</Txt>
          </View>
          <View style={{ alignItems: "center" }}>
            <Txt size={type.sm} color={colors.muted}>Check Out</Txt>
            <Txt display weight="semibold" size={type.xl} color={colors.error}>{fmt(rec?.check_out)}</Txt>
          </View>
        </Row>
        {hours && <Badge label={`${hours} hrs worked`} />}
      </Card>

      {!rec?.check_in ? (
        <Button title="Check In" onPress={checkIn} icon={<SignIn size={20} color={colors.onBrandPrimary} weight="bold" />} testID="checkin-button" style={{ marginTop: spacing.lg }} />
      ) : !rec?.check_out ? (
        <Button title="Check Out" variant="outline" onPress={checkOut} icon={<SignOut size={20} color={colors.brandPrimary} weight="bold" />} testID="checkout-button" style={{ marginTop: spacing.lg }} />
      ) : (
        <Card style={{ marginTop: spacing.lg, alignItems: "center" }}><Txt weight="semibold" color={colors.success}>Shift complete for today ✓</Txt></Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  clockBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});
