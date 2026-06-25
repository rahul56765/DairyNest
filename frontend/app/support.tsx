import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ScrollView, TextInput, Pressable, Linking, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { Phone, WhatsappLogo, ChatCircleText, Plus, EnvelopeSimple } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, font } from "@/src/theme";
import { Txt, Header, Card, Button, Row, Chip, Badge } from "@/src/components/ui";

const CATEGORIES = ["Delivery Issue", "Product Quality", "Payment Issue", "Refund Request", "Subscription Issue"];

const sanitizePhone = (p?: string) => (p || "").replace(/[^0-9+]/g, "");

export default function Support() {
  const toast = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    api.get("/settings").then(setSettings).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try { setTickets(await api.get("/tickets")); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return toast.show("Fill subject & message", "error");
    setBusy(true);
    try {
      await api.post("/tickets", { category, subject, message });
      toast.show("Ticket raised!", "success");
      setShowForm(false); setSubject(""); setMessage("");
      load();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };

  const primaryPhone = sanitizePhone(settings.support_phone) || "+918000000000";
  const altPhone = sanitizePhone(settings.support_phone_alt);
  const supportEmail = settings.support_email || "";
  const whatsappPhone = primaryPhone.replace(/^\+/, "");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Customer Support" back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }} keyboardShouldPersistTaps="handled">
          <Row style={{ gap: spacing.md }}>
            <ContactBtn icon={<Phone size={22} color={colors.brandPrimary} weight="fill" />} label="Call" onPress={() => Linking.openURL(`tel:${primaryPhone}`)} testID="contact-call" />
            <ContactBtn icon={<WhatsappLogo size={22} color={colors.brandPrimary} weight="fill" />} label="WhatsApp" onPress={() => Linking.openURL(`whatsapp://send?phone=${whatsappPhone}`).catch(() => toast.show("WhatsApp not installed", "error"))} testID="contact-whatsapp" />
            <ContactBtn icon={<ChatCircleText size={22} color={colors.brandPrimary} weight="fill" />} label="Live Chat" onPress={() => toast.show("Live chat coming soon", "info")} testID="contact-chat" />
          </Row>

          {/* Admin-managed support contacts */}
          {(settings.support_phone || settings.support_phone_alt || settings.support_email) && (
            <Card style={{ marginTop: spacing.lg, backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary }}>
              <Txt weight="semibold" style={{ marginBottom: spacing.sm }}>Reach us anytime</Txt>
              {!!settings.support_phone && (
                <Pressable testID="support-phone-row" onPress={() => Linking.openURL(`tel:${sanitizePhone(settings.support_phone)}`)} style={styles.row}>
                  <Phone size={16} color={colors.brandPrimary} weight="fill" />
                  <Txt color={colors.brandPrimary} weight="medium">{settings.support_phone}</Txt>
                </Pressable>
              )}
              {!!altPhone && !!settings.support_phone_alt && (
                <Pressable testID="support-phone-alt-row" onPress={() => Linking.openURL(`tel:${altPhone}`)} style={styles.row}>
                  <Phone size={16} color={colors.brandPrimary} />
                  <Txt color={colors.brandPrimary}>{settings.support_phone_alt}</Txt>
                </Pressable>
              )}
              {!!supportEmail && (
                <Pressable testID="support-email-row" onPress={() => Linking.openURL(`mailto:${supportEmail}`)} style={styles.row}>
                  <EnvelopeSimple size={16} color={colors.brandPrimary} />
                  <Txt color={colors.brandPrimary}>{supportEmail}</Txt>
                </Pressable>
              )}
            </Card>
          )}

          {!showForm ? (
            <Button title="Raise a Ticket" onPress={() => setShowForm(true)} icon={<Plus size={20} color={colors.onBrandPrimary} weight="bold" />} testID="raise-ticket-button" style={{ marginTop: spacing.lg }} />
          ) : (
            <Card style={{ marginTop: spacing.lg }}>
              <Txt display weight="semibold" size={type.lg} style={{ marginBottom: spacing.md }}>New Ticket</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
                {CATEGORIES.map((c) => <View key={c} style={{ flexShrink: 0 }}><Chip label={c} active={category === c} onPress={() => setCategory(c)} testID={`ticket-cat-${c}`} /></View>)}
              </ScrollView>
              <TextInput testID="ticket-subject" value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput testID="ticket-message" value={message} onChangeText={setMessage} placeholder="Describe your issue..." placeholderTextColor={colors.muted} multiline style={[styles.input, { height: 100, textAlignVertical: "top", paddingTop: spacing.md }]} />
              <Row style={{ gap: spacing.md, marginTop: spacing.sm }}>
                <Button title="Cancel" variant="outline" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
                <Button title="Submit" onPress={submit} loading={busy} style={{ flex: 1 }} testID="submit-ticket-button" />
              </Row>
            </Card>
          )}

          <Txt display weight="semibold" size={type.lg} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>My Tickets</Txt>
          {tickets.length === 0 ? (
            <Txt color={colors.muted}>No tickets yet.</Txt>
          ) : tickets.map((t) => (
            <Card key={t.id} style={{ marginBottom: spacing.md }} testID={`ticket-${t.id}`}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt weight="semibold" style={{ flex: 1 }}>{t.subject}</Txt>
                <Badge label={t.status} color={t.status === "resolved" ? colors.success : colors.warning} bg={t.status === "resolved" ? "#E3F0E8" : "#FBEEDC"} />
              </Row>
              <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>{t.category}</Txt>
              <Txt color={colors.onSurfaceTertiary} size={type.sm} style={{ marginTop: spacing.sm }}>{t.message}</Txt>
            </Card>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ContactBtn({ icon, label, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.contact}>
      {icon}
      <Txt weight="medium" size={type.sm} style={{ marginTop: 6 }}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contact: { flex: 1, alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg },
  input: { height: 50, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface, fontFamily: font.medium, color: colors.onSurface, marginTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
});
