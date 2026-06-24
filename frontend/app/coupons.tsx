import { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Tag, Copy } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Header, Card, Loading, Row, Badge } from "@/src/components/ui";

export default function Coupons() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<any[] | null>(null);

  useEffect(() => {
    api.get("/coupons").then(setCoupons).catch(() => setCoupons([]));
  }, []);

  if (!coupons) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Coupons" back /><Loading /></View>;

  const copy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    toast.show(`${code} copied!`, "success");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Coupons & Offers" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}>
        {coupons.map((c) => (
          <Card key={c.code} style={styles.card} testID={`coupon-${c.code}`}>
            <View style={styles.iconBox}>
              <Tag size={24} color={colors.brandPrimary} weight="fill" />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Row style={{ gap: spacing.sm }}>
                <Txt display weight="semibold" size={type.lg}>{c.code}</Txt>
                <Badge label={c.type === "percent" ? `${c.value}% OFF` : `₹${c.value} OFF`} />
              </Row>
              <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>
                {c.min_order > 0 ? `On orders above ₹${c.min_order}` : "No minimum order"}
                {c.type === "percent" && c.max_discount ? ` · up to ₹${c.max_discount}` : ""}
              </Txt>
            </View>
            <Pressable testID={`copy-coupon-${c.code}`} onPress={() => copy(c.code)} style={styles.copyBtn}>
              <Copy size={18} color={colors.brandPrimary} />
            </Pressable>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  iconBox: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.brandSecondary, borderStyle: "dashed" },
  copyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});
