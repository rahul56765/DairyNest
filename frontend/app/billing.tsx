import { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { DownloadSimple } from "phosphor-react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Header, Button, Card, Loading, Row } from "@/src/components/ui";

export default function Billing() {
  const { user } = useAuth();
  const toast = useToast();
  const [bill, setBill] = useState<any>(null);

  useEffect(() => {
    api.get("/billing/monthly").then(setBill).catch(() => {});
  }, []);

  if (!bill) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Billing" back /><Loading /></View>;

  const rows = [
    { label: "Milk Charges", value: bill.milk_charges },
    { label: "Vegetable Charges", value: bill.vegetable_charges },
    { label: "Fruit Charges", value: bill.fruit_charges },
    { label: "Delivery Charges", value: bill.delivery_charges },
    { label: "Discounts", value: -bill.discounts, green: true },
    { label: "GST (5%)", value: bill.tax },
  ];

  const downloadPDF = async () => {
    const html = `
      <html><body style="font-family: -apple-system, sans-serif; padding: 24px; color:#1B2A1E;">
      <h1 style="color:#3A5940;">DairyNest</h1>
      <p style="color:#7A857C;">GST Invoice · ${bill.month}</p>
      <hr/>
      <p><b>Billed to:</b> ${user?.name} (+91 ${user?.phone})</p>
      <table style="width:100%; border-collapse: collapse; margin-top:16px;">
        ${rows.map((r) => `<tr><td style="padding:8px 0;color:#2C4230;">${r.label}</td><td style="text-align:right;">₹${r.value}</td></tr>`).join("")}
        <tr style="border-top:2px solid #3A5940;"><td style="padding:12px 0;font-weight:bold;">Final Amount</td><td style="text-align:right;font-weight:bold;font-size:18px;color:#3A5940;">₹${bill.final_amount}</td></tr>
      </table>
      <p style="margin-top:32px;color:#7A857C;font-size:12px;">GSTIN: 29ABCDE1234F1Z5 · Thank you for choosing DairyNest!</p>
      </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else toast.show("Invoice generated", "success");
    } catch (e: any) {
      toast.show("Could not generate PDF", "error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Monthly Bill" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}>
        <Card>
          <Txt color={colors.muted}>{bill.month}</Txt>
          <Txt display weight="semibold" size={type["3xl"]} color={colors.brandPrimary} style={{ marginVertical: spacing.sm }}>₹{bill.final_amount}</Txt>
          <Txt color={colors.muted} size={type.sm}>Estimated total payable</Txt>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt display weight="semibold" size={type.lg} style={{ marginBottom: spacing.md }}>Breakdown</Txt>
          {rows.map((r) => (
            <Row key={r.label} style={{ justifyContent: "space-between", paddingVertical: spacing.sm }}>
              <Txt color={colors.onSurfaceTertiary}>{r.label}</Txt>
              <Txt weight="semibold" color={r.green ? colors.success : colors.onSurface}>₹{r.value}</Txt>
            </Row>
          ))}
          <View style={styles.divider} />
          <Row style={{ justifyContent: "space-between" }}>
            <Txt weight="semibold" size={type.lg}>Final Amount</Txt>
            <Txt display weight="semibold" size={type.lg} color={colors.brandPrimary}>₹{bill.final_amount}</Txt>
          </Row>
        </Card>

        <Button title="Download PDF Invoice" onPress={downloadPDF} testID="download-invoice-button" icon={<DownloadSimple size={20} color={colors.onBrandPrimary} weight="bold" />} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
});
