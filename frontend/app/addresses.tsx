import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { MapPin, Trash, Plus, Check, NavigationArrow } from "phosphor-react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { useDeviceLocation } from "@/src/hooks/use-device-location";
import { colors, spacing, radius, type, font } from "@/src/theme";
import { Txt, Header, Card, Button, Row, Badge } from "@/src/components/ui";

type Form = {
  label: string;
  apartment: string;
  flat: string;
  floor: string;
  landmark: string;
  area_name: string;
  lat?: number | null;
  lng?: number | null;
};

const EMPTY: Form = { label: "Home", apartment: "", flat: "", floor: "", landmark: "", area_name: "", lat: null, lng: null };

export default function Addresses() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const { loc, loading: locLoading, fetchNow } = useDeviceLocation(false);
  const set = (k: keyof Form) => (v: string) => setForm({ ...form, [k]: v });

  useFocusEffect(useCallback(() => { refresh(); }, []));

  // Auto-open form + fetch location when navigated with ?auto=1 (from LocationBanner)
  useEffect(() => {
    if (params.auto === "1" && !showForm) {
      setShowForm(true);
      (async () => {
        const l = await fetchNow();
        if (l) {
          setForm((f) => ({ ...f, area_name: l.area_name || "", lat: l.lat, lng: l.lng }));
          toast.show("Pinned current location", "success");
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.auto]);

  const useGPS = async () => {
    const l = await fetchNow();
    if (l) {
      setForm((f) => ({ ...f, area_name: l.area_name || "", lat: l.lat, lng: l.lng }));
      toast.show("Location pinned", "success");
    } else {
      toast.show("Could not get location — enable permission", "error");
    }
  };

  const addresses = user?.addresses || [];
  const defaultId = user?.default_address_id;

  const add = async () => {
    if (!form.apartment.trim() || !form.flat.trim()) return toast.show("Apartment & flat required", "error");
    setBusy(true);
    try {
      await api.post("/addresses", { ...form, is_default: addresses.length === 0 });
      toast.show("Address added", "success");
      setShowForm(false); setForm(EMPTY);
      refresh();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };
  const setDefault = async (id: string) => { await api.put(`/addresses/${id}/default`); toast.show("Default updated", "success"); refresh(); };
  const remove = async (id: string) => { await api.del(`/addresses/${id}`); toast.show("Address removed", "info"); refresh(); };

  const gpsPinned = !!(form.lat && form.lng);

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
                      {(a.lat && a.lng) && <Badge label="GPS" color={colors.info} bg="#E4ECF6" />}
                    </Row>
                    <Txt color={colors.muted} size={type.sm}>{a.flat}, {a.apartment}{a.landmark ? `, ${a.landmark}` : ""}</Txt>
                    {!!a.area_name && <Txt color={colors.muted} size={type.sm} numberOfLines={1}>{a.area_name}</Txt>}
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

              <Pressable testID="gps-button" onPress={useGPS} disabled={locLoading} style={[styles.gpsBtn, gpsPinned && styles.gpsBtnDone]}>
                {locLoading ? (
                  <ActivityIndicator color={colors.brandPrimary} size="small" />
                ) : (
                  <NavigationArrow size={18} color={gpsPinned ? colors.success : colors.brandPrimary} weight={gpsPinned ? "fill" : "bold"} />
                )}
                <View style={{ flex: 1 }}>
                  <Txt weight="semibold" size={type.sm} color={gpsPinned ? colors.success : colors.brandPrimary}>
                    {gpsPinned ? "Location pinned" : "Use current location"}
                  </Txt>
                  {gpsPinned && !!form.area_name && (
                    <Txt color={colors.muted} size={type.sm} numberOfLines={1}>{form.area_name}</Txt>
                  )}
                </View>
              </Pressable>

              {[
                { k: "label", p: "Label (Home/Work)" },
                { k: "apartment", p: "Apartment / Society" },
                { k: "flat", p: "Flat number" },
                { k: "floor", p: "Floor (optional)" },
                { k: "landmark", p: "Landmark (optional)" },
                { k: "area_name", p: "Area / Locality" },
              ].map((f) => (
                <TextInput
                  key={f.k}
                  testID={`addr-${f.k}`}
                  value={(form as any)[f.k]}
                  onChangeText={set(f.k as keyof Form)}
                  placeholder={f.p}
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              ))}
              <Row style={{ gap: spacing.md, marginTop: spacing.sm }}>
                <Button title="Cancel" variant="outline" onPress={() => { setShowForm(false); setForm(EMPTY); }} style={{ flex: 1 }} />
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
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.brandSecondary,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.brandTertiary,
    marginBottom: spacing.md,
  },
  gpsBtnDone: { borderColor: colors.success, borderStyle: "solid", backgroundColor: "#E3F0E8" },
});
