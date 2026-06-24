import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Share, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { Gift, Copy, ShareNetwork, WhatsappLogo, TelegramLogo, ChatCircleText } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Card, Loading, Row } from "@/src/components/ui";
import { Linking } from "react-native";

export default function Rewards() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/referrals/me");
      setData(d);
    } catch {}
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <Loading />;
  const msg = `Join me on DairyNest for farm-fresh milk & organic produce! Use my code ${data.code} for ₹100 off. ${data.link}`;

  const copy = async () => {
    await Clipboard.setStringAsync(data.code);
    toast.show("Referral code copied!", "success");
  };
  const shareGeneric = () => Share.share({ message: msg }).catch(() => {});
  const openApp = (url: string) => Linking.openURL(url).catch(() => toast.show("App not installed", "error"));

  const stats = data.stats;
  const funnel = [
    { label: "Link Clicks", value: stats.clicks },
    { label: "App Installs", value: stats.installs },
    { label: "Signups", value: stats.signups },
    { label: "Paid Orders", value: stats.paid_orders },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing["3xl"] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
    >
      <Txt display weight="semibold" size={type["2xl"]} style={{ paddingHorizontal: spacing.lg }}>Refer & Earn</Txt>

      <LinearGradient colors={[colors.brandPrimary, colors.brand]} style={styles.codeCard}>
        <Gift size={32} color={colors.onBrandPrimary} weight="fill" />
        <Txt color={colors.brandSecondary} style={{ marginTop: spacing.sm }}>Your referral code</Txt>
        <Pressable testID="copy-code-button" onPress={copy} style={styles.codeRow}>
          <Txt display weight="semibold" size={type["3xl"]} color={colors.onBrandPrimary} style={{ letterSpacing: 2 }}>{data.code}</Txt>
          <Copy size={22} color={colors.onBrandPrimary} />
        </Pressable>
        <Txt color={colors.brandSecondary} size={type.sm}>Earn ₹100 for every friend who orders</Txt>
        <Row style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Pressable testID="share-whatsapp" onPress={() => openApp(`whatsapp://send?text=${encodeURIComponent(msg)}`)} style={styles.socialBtn}>
            <WhatsappLogo size={22} color={colors.onBrandPrimary} weight="fill" />
          </Pressable>
          <Pressable testID="share-telegram" onPress={() => openApp(`tg://msg?text=${encodeURIComponent(msg)}`)} style={styles.socialBtn}>
            <TelegramLogo size={22} color={colors.onBrandPrimary} weight="fill" />
          </Pressable>
          <Pressable testID="share-sms" onPress={() => openApp(`sms:?body=${encodeURIComponent(msg)}`)} style={styles.socialBtn}>
            <ChatCircleText size={22} color={colors.onBrandPrimary} weight="fill" />
          </Pressable>
          <Pressable testID="share-more" onPress={shareGeneric} style={[styles.socialBtn, { flex: 1, flexDirection: "row", gap: spacing.sm }]}>
            <ShareNetwork size={20} color={colors.onBrandPrimary} weight="fill" />
            <Txt weight="semibold" color={colors.onBrandPrimary}>Share Link</Txt>
          </Pressable>
        </Row>
      </LinearGradient>

      <Row style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.lg }}>
        <Card style={{ flex: 1, alignItems: "center" }}>
          <Txt display weight="semibold" size={type["2xl"]} color={colors.brandPrimary}>₹{data.total_rewards}</Txt>
          <Txt color={colors.muted} size={type.sm}>Total earned</Txt>
        </Card>
        <Card style={{ flex: 1, alignItems: "center" }}>
          <Txt display weight="semibold" size={type["2xl"]} color={colors.brandPrimary}>{data.conversion}%</Txt>
          <Txt color={colors.muted} size={type.sm}>Conversion</Txt>
        </Card>
      </Row>

      <Txt display weight="semibold" size={type.xl} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md }}>
        Referral Funnel
      </Txt>
      <Card style={{ marginHorizontal: spacing.lg }}>
        {funnel.map((f, i) => (
          <Row key={f.label} style={[styles.funnelRow, i < funnel.length - 1 && styles.funnelBorder]}>
            <Txt color={colors.onSurfaceTertiary}>{f.label}</Txt>
            <Txt display weight="semibold" size={type.lg} color={colors.brandPrimary}>{f.value}</Txt>
          </Row>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  codeCard: { margin: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, alignItems: "center" },
  codeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.sm },
  socialBtn: { height: 48, minWidth: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  funnelRow: { justifyContent: "space-between", paddingVertical: spacing.md },
  funnelBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
