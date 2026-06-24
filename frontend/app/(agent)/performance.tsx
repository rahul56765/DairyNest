import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, Package, CalendarCheck, Trophy } from "phosphor-react-native";
import { api } from "@/src/api";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Card, Loading, Row } from "@/src/components/ui";

export default function Performance() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    try { setData(await api.get("/agent/performance")); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <Loading />;

  const cards = [
    { label: "Deliveries Completed", value: data.completed, Icon: Package, color: colors.brandPrimary },
    { label: "Success Rate", value: `${data.success_rate}%`, Icon: CheckCircle, color: colors.success },
    { label: "Attendance Days", value: data.attendance_days, Icon: CalendarCheck, color: colors.info },
    { label: "Monthly Score", value: data.monthly_score, Icon: Trophy, color: colors.warning },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, padding: spacing.lg, paddingBottom: spacing["3xl"] }}>
      <Txt display weight="semibold" size={type["2xl"]} style={{ marginBottom: spacing.lg }}>My Performance</Txt>
      <View style={styles.grid}>
        {cards.map((c) => (
          <Card key={c.label} style={styles.card}>
            <View style={[styles.iconBox, { backgroundColor: c.color + "22" }]}>
              <c.Icon size={24} color={c.color} weight="fill" />
            </View>
            <Txt display weight="semibold" size={type["2xl"]} style={{ marginTop: spacing.sm }}>{c.value}</Txt>
            <Txt color={colors.muted} size={type.sm}>{c.label}</Txt>
          </Card>
        ))}
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <Txt weight="semibold">Monthly Progress</Txt>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${data.monthly_score}%` }]} />
        </View>
        <Txt color={colors.muted} size={type.sm}>{data.completed} of {data.total} assigned deliveries completed</Txt>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.md },
  card: { width: "48%" },
  iconBox: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  barBg: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceTertiary, marginVertical: spacing.md, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
});
