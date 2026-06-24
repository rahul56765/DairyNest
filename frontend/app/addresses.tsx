import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { MapPin, Trash, Plus, Check } from "phosphor-react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, font } from "@/src/theme";
import { Txt, Header, Card, Button, Row, Badge } from "@/src/components/ui";

export default function Addresses() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ label: "Home", apartment: "", flat: "", floor: "", landmark: "" });
  const set = (k: string) => (v: string) => setForm({ ...form, [k]: v });

  useFocusEffect(useCallback(() => { refresh(); }, []));

  const addresses = user?.addresses || [];
  const defaultId = user?.default_address_id;

  const add = async () => {
    if (!form.apartment.trim() || !form.flat.trim()) return toast.show("Apartment & flat required", "error");
    setBusy(true);
    try {
      await api.post("/addresses", { ...form, is_default: addresses.length === 0 });
      toast.show("Address added", "success");
      setShowForm(false); setForm({ label: "Home", apartment: "", flat: "", floor: "", landmark: "" });
      refresh();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };
  const setDefault = async (id: string) => { await api.put(`/addresses/${id}/default`); toast.show("Default updated", "success"); refresh(); };
  const remove = async (id: string) => { await api.del(`/addresses/${id}`); toast.show("Address removed", "info"); refresh(); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Manage Addresses" back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }} keyboardShouldPersistTaps="handled">
          {addresses.map((a: any) => (
            <Card key={a.id} style={{ marginBottom: spacing.md }} testID={`address-${a.id}`}>
              <Row style={{ justifyContent: "space-between" }}>
                <Row style={{ gap: spacing.sm, flex: 1 }}>
                  <MapPin size={20} color={colors.brandPrimary} weight="fill" />
                  <View style={{ flex: 1 }}>
                    <Row style={{ gap: spacing.sm }}>
                      <Txt weight="semibold">{a.label}</Txt>
                      {a.id === defaultId && <Badge label="Default" />}
                    </Row>
                    <Txt color={colors.muted} size={type.sm}>{a.flat}, {a.apartment}{a.landmark ? `, ${a.landmark}` : ""}</Txt>
                  </View>
                </Row>
                <Pressable testID={`del-addr-${a.id}`} onPress={() => remove(a.id)} hitSlop={8}><Trash size={18} color={colors.error} /></Pressable>
              </Row>
              {a.id !== defaultId && (
                <Pressable testID={`default-addr-${a.id}`} onPress={() => setDefault(a.id)} style={styles.defBtn}>
                  <Check size={16} color={colors.brandPrimary} weight="bold" />
                  <Txt weight="medium" size={type.sm} color={colors.brandPrimary}>Set as default</Txt>
                </Pressable>
              )}
            </Card>
          ))}

          {!showForm ? (
            <Button title="Add New Address" onPress={() => setShowForm(true)} icon={<Plus size={20} color={colors.onBrandPrimary} weight="bold" />} testID="add-address-button" style={{ marginTop: spacing.sm }} />
          ) : (
            <Card style={{ marginTop: spacing.sm }}>
              <Txt display weight="semibold" size={type.lg} style={{ marginBottom: spacing.md }}>New Address</Txt>
              {[
                { k: "label", p: "Label (Home/Work)" },
                { k: "apartment", p: "Apartment / Society" },
                { k: "flat", p: "Flat number" },
                { k: "floor", p: "Floor (optional)" },
                { k: "landmark", p: "Landmark (optional)" },
              ].map((f) => (
                <TextInput key={f.k} testID={`addr-${f.k}`} value={(form as any)[f.k]} onChangeText={set(f.k)} placeholder={f.p} placeholderTextColor={colors.muted} style={styles.input} />
              ))}
              <Row style={{ gap: spacing.md, marginTop: spacing.sm }}>
                <Button title="Cancel" variant="outline" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
                <Button title="Save" onPress={add} loading={busy} style={{ flex: 1 }} testID="save-address-button" />
              </Row>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  defBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  input: { height: 50, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface, fontFamily: font.medium, color: colors.onSurface, marginBottom: spacing.sm },
});
