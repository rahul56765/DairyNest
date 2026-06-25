import { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, TextInput, Pressable, Modal, KeyboardAvoidingView, Platform, Switch, Image as RNImage } from "react-native";
import { Sparkle, Plus, Pencil, X, Power, ShieldCheck, UserPlus, Trash, Check, Megaphone } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, font } from "@/src/theme";
import { Txt, Card, Loading, Row, Badge, Button, QtyStepper } from "@/src/components/ui";
import ImageUploadField from "@/src/components/image-upload";

export const MANAGER_MODULES = ["customers", "orders", "products", "inventory", "marketing", "support", "reports"];

// ---------- App Settings (admin only) ----------
export function SettingsTab() {
  const toast = useToast();
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/admin/settings").then(setS).catch(() => {}); }, []);
  if (!s) return <Loading />;
  const set = (k: string, v: any) => setS({ ...s, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.put("/admin/settings", {
        subscription_first_amount: parseFloat(s.subscription_first_amount) || 0,
        subscription_pricing_mode: s.subscription_pricing_mode,
        subscription_regular_flat_amount: parseFloat(s.subscription_regular_flat_amount) || 0,
        first_order_discount_enabled: !!s.first_order_discount_enabled,
        first_order_discount_percent: parseInt(s.first_order_discount_percent) || 0,
        first_order_discount_max: parseInt(s.first_order_discount_max) || 0,
        min_order_for_first_discount: parseInt(s.min_order_for_first_discount) || 0,
      });
      setS(r);
      toast.show("Settings saved", "success");
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };

  return (
    <View>
      <Card style={{ marginBottom: spacing.md, backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary }}>
        <Txt weight="semibold">Subscription Recurring Payment</Txt>
        <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>Configure trial amount and regular charges.</Txt>
      </Card>
      <FormField label="First recurring charge (₹)" testID="set-first-amt" value={String(s.subscription_first_amount ?? "")} onChange={(v) => set("subscription_first_amount", v)} keyboardType="numeric" />
      <Txt size={type.sm} color={colors.muted} style={{ marginBottom: 4 }}>Regular pricing mode</Txt>
      <Row style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        {["per_delivery", "flat"].map((k) => (
          <Pressable key={k} testID={`set-mode-${k}`} onPress={() => set("subscription_pricing_mode", k)} style={[styles.typePill, s.subscription_pricing_mode === k && styles.typePillActive, { flex: 1 }]}>
            <Txt weight="semibold" size={type.sm} color={s.subscription_pricing_mode === k ? colors.onBrandPrimary : colors.onSurface}>{k === "per_delivery" ? "Per delivery" : "Flat ₹"}</Txt>
          </Pressable>
        ))}
      </Row>
      {s.subscription_pricing_mode === "flat" && (
        <FormField label="Regular flat amount per cycle (₹)" testID="set-flat" value={String(s.subscription_regular_flat_amount ?? "")} onChange={(v) => set("subscription_regular_flat_amount", v)} keyboardType="numeric" />
      )}

      <Card style={{ marginVertical: spacing.md, backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary }}>
        <Txt weight="semibold">First-time Buyer Offer</Txt>
        <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>Discount auto-applied on the first order.</Txt>
      </Card>
      <Pressable testID="set-firstoff-toggle" onPress={() => set("first_order_discount_enabled", !s.first_order_discount_enabled)} style={[styles.permRow, { paddingHorizontal: 4 }]}>
        <View style={[styles.checkbox, s.first_order_discount_enabled && styles.checkboxOn]}>
          {s.first_order_discount_enabled && <Check size={14} color={colors.onBrandPrimary} weight="bold" />}
        </View>
        <Txt weight="medium" style={{ flex: 1 }}>Enable first-order discount</Txt>
      </Pressable>
      <FormField label="Discount %" testID="set-pct" value={String(s.first_order_discount_percent ?? "")} onChange={(v) => set("first_order_discount_percent", v)} keyboardType="numeric" />
      <FormField label="Max discount (₹)" testID="set-max" value={String(s.first_order_discount_max ?? "")} onChange={(v) => set("first_order_discount_max", v)} keyboardType="numeric" />
      <FormField label="Minimum order (₹) to qualify" testID="set-min" value={String(s.min_order_for_first_discount ?? "")} onChange={(v) => set("min_order_for_first_discount", v)} keyboardType="numeric" />

      <Button title="Save Settings" loading={busy} onPress={save} testID="set-save" style={{ marginTop: spacing.md }} />
    </View>
  );
}

// ---------- Send Push Notification (admin + marketing-perm manager) ----------
export function NotifyTab() {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"all" | "customer" | "agent" | "manager" | "admin">("customer");
  const [busy, setBusy] = useState(false);
  const targets: { k: typeof target; label: string }[] = [
    { k: "all", label: "All Users" },
    { k: "customer", label: "Customers" },
    { k: "agent", label: "Delivery Agents" },
    { k: "manager", label: "Managers" },
    { k: "admin", label: "Admins" },
  ];

  const send = async () => {
    if (!title.trim() || !body.trim()) return toast.show("Title & message required", "error");
    setBusy(true);
    try {
      const r = await api.post("/admin/push/broadcast", { title: title.trim(), body: body.trim(), target });
      toast.show(`Sent to ${r.recipients ?? 0} user(s) (${r.sent ?? 0} devices)`, "success");
      setTitle(""); setBody("");
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };

  return (
    <View>
      <Card style={{ marginBottom: spacing.md, backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary }}>
        <Row style={{ gap: spacing.sm }}>
          <Sparkle size={18} color={colors.brandPrimary} weight="fill" />
          <Txt weight="semibold">Push Notification Broadcast</Txt>
        </Row>
        <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>
          Send instant notifications. The phone will vibrate.
        </Txt>
      </Card>
      <FormField label="Title" testID="nf-title" value={title} onChange={setTitle} />
      <View style={{ marginBottom: spacing.sm }}>
        <Txt size={type.sm} color={colors.muted} style={{ marginBottom: 4 }}>Message</Txt>
        <TextInput
          testID="nf-body"
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="Your notification content..."
          placeholderTextColor={colors.muted}
          style={[styles.input, { height: 100, paddingTop: spacing.sm, textAlignVertical: "top" }]}
        />
      </View>
      <Txt size={type.sm} color={colors.muted} style={{ marginBottom: 4 }}>Send to</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }}>
        {targets.map((t) => {
          const on = target === t.k;
          return (
            <Pressable
              key={t.k}
              onPress={() => setTarget(t.k)}
              testID={`nf-target-${t.k}`}
              style={[styles.typePill, { flex: 0, paddingHorizontal: spacing.md }, on && styles.typePillActive]}
            >
              <Txt weight="semibold" size={type.sm} color={on ? colors.onBrandPrimary : colors.onSurface}>{t.label}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Button title="Send Notification" loading={busy} onPress={send} testID="nf-send" />
    </View>
  );
}

// ---------- Products ----------
export function ProductsTab() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.get("/admin/products")); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const disable = async (id: string) => { await api.del(`/admin/products/${id}`); toast.show("Product disabled", "info"); load(); };

  if (loading) return <Loading />;
  return (
    <View>
      <Button title="Add Product" icon={<Plus size={18} color={colors.onBrandPrimary} weight="bold" />} onPress={() => setCreating(true)} testID="add-product-button" style={{ marginBottom: spacing.md, height: 44 }} />
      {items.map((p) => (
        <Card key={p.id} style={{ marginBottom: spacing.md }} testID={`product-${p.id}`}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Txt weight="semibold">{p.name}</Txt>
              <Txt color={colors.muted} size={type.sm}>{p.category} · ₹{p.price} · stock {p.stock}</Txt>
            </View>
            <Badge label={p.active ? "Active" : "Disabled"} color={p.active ? colors.success : colors.muted} bg={p.active ? "#E3F0E8" : colors.surfaceTertiary} />
          </Row>
          <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title="Edit" variant="outline" onPress={() => setEditing(p)} testID={`edit-${p.id}`} style={{ flex: 1, height: 38 }} />
            {p.active && <Button title="Disable" variant="outline" onPress={() => disable(p.id)} style={{ flex: 1, height: 38 }} testID={`disable-${p.id}`} />}
          </Row>
        </Card>
      ))}
      <ProductFormModal visible={creating || !!editing} initial={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={() => { setEditing(null); setCreating(false); load(); }} />
    </View>
  );
}

function ProductFormModal({ visible, initial, onClose, onSaved }: { visible: boolean; initial: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm(initial || { type: "milk", category: "", name: "", price: 0, stock: 100, unit: "litre", weight: "1 L", image: "", farm_source: "", organic: false, milk_type: null, availability: true });
  }, [initial]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name || !form.category || !form.type) return toast.show("Name, type, category required", "error");
    setBusy(true);
    try {
      const payload = { ...form, price: Number(form.price) || 0, stock: Number(form.stock) || 0 };
      if (initial?.id) await api.put(`/admin/products/${initial.id}`, payload);
      else await api.post("/admin/products", payload);
      toast.show("Product saved", "success");
      onSaved();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modal}>
          <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
            <Txt display weight="semibold" size={type.xl}>{initial?.id ? "Edit Product" : "New Product"}</Txt>
            <Pressable onPress={onClose} hitSlop={10} testID="product-modal-close"><X size={22} color={colors.onSurface} /></Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
            <FormField label="Name" testID="pf-name" value={form.name} onChange={(v) => set("name", v)} />
            <FormField label="Type (milk/vegetable/fruit/dairy)" testID="pf-type" value={form.type} onChange={(v) => set("type", v)} />
            <FormField label="Category" testID="pf-category" value={form.category} onChange={(v) => set("category", v)} />
            <FormField label="Price (₹)" testID="pf-price" value={String(form.price ?? "")} onChange={(v) => set("price", v)} keyboardType="numeric" />
            <FormField label="Stock" testID="pf-stock" value={String(form.stock ?? "")} onChange={(v) => set("stock", v)} keyboardType="numeric" />
            <FormField label="Weight (e.g. 1 L)" testID="pf-weight" value={form.weight} onChange={(v) => set("weight", v)} />
            <FormField label="Unit" testID="pf-unit" value={form.unit} onChange={(v) => set("unit", v)} />
            <FormField label="Farm source" testID="pf-farm" value={form.farm_source} onChange={(v) => set("farm_source", v)} />
            <ImageUploadField
              label="Product image"
              testID="pf-image"
              value={form.image || ""}
              onChange={(uri) => set("image", uri)}
              aspect={[1, 1]}
              hint="Square crop works best (1:1)"
            />
            <Row style={{ justifyContent: "space-between", marginVertical: spacing.sm }}>
              <Txt weight="medium">Organic</Txt>
              <Switch testID="pf-organic" value={!!form.organic} onValueChange={(v) => set("organic", v)} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} />
            </Row>
          </ScrollView>
          <Row style={{ gap: spacing.md, marginTop: spacing.sm }}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save" onPress={save} loading={busy} style={{ flex: 1 }} testID="product-save-button" />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- Inventory ----------
export function InventoryTab() {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const load = useCallback(async () => { try { setData(await api.get("/admin/inventory")); } catch {} }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (id: string, stock: number) => {
    try {
      await api.put(`/admin/inventory/${id}/stock?stock=${stock}`);
      toast.show("Stock updated", "success");
      setEdits((e) => { const c = { ...e }; delete c[id]; return c; });
      load();
    } catch (e: any) { toast.show(e.message, "error"); }
  };

  if (!data) return <Loading />;
  return (
    <View>
      {data.low_stock.length > 0 && (
        <Card style={{ marginBottom: spacing.md, backgroundColor: "#FBEEDC", borderColor: colors.warning }}>
          <Txt weight="semibold" color={colors.warning}>⚠ {data.low_stock.length} items low on stock</Txt>
        </Card>
      )}
      {data.items.map((it: any) => {
        const current = edits[it.id] !== undefined ? edits[it.id] : it.stock;
        const dirty = edits[it.id] !== undefined && edits[it.id] !== it.stock;
        return (
          <Card key={it.id} style={{ marginBottom: spacing.sm }} testID={`inv-${it.id}`}>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Txt weight="medium">{it.name}</Txt>
                <Txt color={colors.muted} size={type.sm}>{it.type} · ₹{it.price}</Txt>
              </View>
              <QtyStepper qty={current} onChange={(q) => setEdits((e) => ({ ...e, [it.id]: q }))} testID={`inv-stepper-${it.id}`} />
            </Row>
            {dirty && (
              <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                <Button title="Cancel" variant="outline" onPress={() => setEdits((e) => { const c = { ...e }; delete c[it.id]; return c; })} style={{ flex: 1, height: 36 }} />
                <Button title={`Save (${current})`} onPress={() => save(it.id, current)} style={{ flex: 1, height: 36 }} testID={`inv-save-${it.id}`} />
              </Row>
            )}
          </Card>
        );
      })}
    </View>
  );
}

// ---------- Coupons ----------
export function CouponsTab() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ code: "", type: "percent", value: 10, min_order: 0, max_discount: 100 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setItems(await api.get("/admin/coupons")); } catch {} }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.code) return toast.show("Code required", "error");
    setBusy(true);
    try {
      await api.post("/admin/coupons", { ...form, value: Number(form.value), min_order: Number(form.min_order), max_discount: Number(form.max_discount), active: true });
      toast.show("Coupon created", "success");
      setShow(false);
      setForm({ code: "", type: "percent", value: 10, min_order: 0, max_discount: 100 });
      load();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };
  const toggle = async (code: string) => { await api.put(`/admin/coupons/${code}/toggle`); load(); };
  const del = async (code: string) => { await api.del(`/admin/coupons/${code}`); toast.show("Deleted", "info"); load(); };

  return (
    <View>
      <Button title="Create Coupon" icon={<Plus size={18} color={colors.onBrandPrimary} weight="bold" />} onPress={() => setShow(true)} testID="add-coupon-button" style={{ marginBottom: spacing.md, height: 44 }} />
      {items.map((c) => (
        <Card key={c.code} style={{ marginBottom: spacing.md }} testID={`coupon-${c.code}`}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Row style={{ gap: spacing.sm }}>
                <Txt display weight="semibold">{c.code}</Txt>
                <Badge label={c.active ? "Active" : "Disabled"} color={c.active ? colors.success : colors.muted} bg={c.active ? "#E3F0E8" : colors.surfaceTertiary} />
              </Row>
              <Txt color={colors.muted} size={type.sm} style={{ marginTop: 2 }}>
                {c.type === "percent" ? `${c.value}% off` : `₹${c.value} off`} · Min ₹{c.min_order} · Max ₹{c.max_discount}
              </Txt>
            </View>
          </Row>
          <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title={c.active ? "Disable" : "Enable"} variant="outline" onPress={() => toggle(c.code)} style={{ flex: 1, height: 38 }} testID={`coupon-toggle-${c.code}`} />
            <Button title="Delete" variant="outline" onPress={() => del(c.code)} style={{ flex: 1, height: 38 }} testID={`coupon-del-${c.code}`} />
          </Row>
        </Card>
      ))}

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
              <Txt display weight="semibold" size={type.xl}>New Coupon</Txt>
              <Pressable onPress={() => setShow(false)} hitSlop={10} testID="coupon-modal-close"><X size={22} color={colors.onSurface} /></Pressable>
            </Row>
            <FormField label="Code (e.g. SUMMER25)" testID="cf-code" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} autoCaps />
            <Row style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
              <Pressable onPress={() => setForm({ ...form, type: "percent" })} style={[styles.typePill, form.type === "percent" && styles.typePillActive]} testID="cf-type-percent">
                <Txt weight="semibold" color={form.type === "percent" ? colors.onBrandPrimary : colors.onSurface}>Percent</Txt>
              </Pressable>
              <Pressable onPress={() => setForm({ ...form, type: "flat" })} style={[styles.typePill, form.type === "flat" && styles.typePillActive]} testID="cf-type-flat">
                <Txt weight="semibold" color={form.type === "flat" ? colors.onBrandPrimary : colors.onSurface}>Flat ₹</Txt>
              </Pressable>
            </Row>
            <FormField label={form.type === "percent" ? "Discount %" : "Flat ₹ off"} testID="cf-value" value={String(form.value)} onChange={(v) => setForm({ ...form, value: Number(v) || 0 })} keyboardType="numeric" />
            <FormField label="Min order ₹" testID="cf-min" value={String(form.min_order)} onChange={(v) => setForm({ ...form, min_order: Number(v) || 0 })} keyboardType="numeric" />
            <FormField label="Max discount ₹" testID="cf-max" value={String(form.max_discount)} onChange={(v) => setForm({ ...form, max_discount: Number(v) || 0 })} keyboardType="numeric" />
            <Row style={{ gap: spacing.md, marginTop: spacing.sm }}>
              <Button title="Cancel" variant="outline" onPress={() => setShow(false)} style={{ flex: 1 }} />
              <Button title="Create" loading={busy} onPress={add} style={{ flex: 1 }} testID="coupon-save-button" />
            </Row>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------- Managers (admin only) ----------
export function ManagersTab() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<{ name: string; phone: string; permissions: Record<string, boolean> }>({ name: "", phone: "", permissions: {} });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setItems(await api.get("/admin/managers")); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", phone: "", permissions: { customers: true, orders: true } });
    setShow(true);
  };
  const openEdit = (m: any) => {
    setEditing(m);
    setForm({ name: m.name, phone: m.phone, permissions: m.permissions || {} });
    setShow(true);
  };
  const togglePerm = (k: string) => setForm((f) => ({ ...f, permissions: { ...f.permissions, [k]: !f.permissions[k] } }));

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) return toast.show("Name & phone required", "error");
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/admin/managers/${editing.id}/permissions`, { permissions: form.permissions });
        toast.show("Permissions updated", "success");
      } else {
        await api.post("/admin/managers", { name: form.name.trim(), phone: form.phone.trim(), permissions: form.permissions });
        toast.show("Manager created", "success");
      }
      setShow(false);
      load();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };
  const toggleSuspend = async (m: any) => { await api.put(`/admin/managers/${m.id}/toggle`); toast.show(m.suspended ? "Activated" : "Suspended", "info"); load(); };

  if (loading) return <Loading />;
  return (
    <View>
      <Button title="Create Manager" icon={<UserPlus size={18} color={colors.onBrandPrimary} weight="bold" />} onPress={openCreate} testID="add-manager-button" style={{ marginBottom: spacing.md, height: 44 }} />
      {items.length === 0 && <Txt color={colors.muted}>No managers yet. Tap "Create Manager" above.</Txt>}
      {items.map((m) => (
        <Card key={m.id} style={{ marginBottom: spacing.md }} testID={`manager-${m.id}`}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Row style={{ gap: spacing.sm }}>
                <Txt weight="semibold" size={type.lg}>{m.name}</Txt>
                {m.suspended ? <Badge label="Suspended" color={colors.error} bg="#F6E4E4" /> : <Badge label="Active" />}
              </Row>
              <Txt color={colors.muted} size={type.sm}>+91 {m.phone}</Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm }}>
                {Object.entries(m.permissions || {}).filter(([, v]) => v).map(([k]) => (
                  <View key={k} style={styles.permPill}>
                    <Check size={11} color={colors.brandPrimary} weight="bold" />
                    <Txt weight="medium" size={type.sm} color={colors.brandPrimary}>{k}</Txt>
                  </View>
                ))}
                {Object.values(m.permissions || {}).every((v) => !v) && <Txt color={colors.muted} size={type.sm}>No permissions</Txt>}
              </View>
            </View>
          </Row>
          <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <Button title="Edit Permissions" variant="outline" onPress={() => openEdit(m)} icon={<Pencil size={14} color={colors.brandPrimary} weight="bold" />} style={{ flex: 1, height: 40 }} testID={`edit-manager-${m.id}`} />
            <Button title={m.suspended ? "Activate" : "Suspend"} variant="outline" onPress={() => toggleSuspend(m)} icon={<Power size={14} color={colors.brandPrimary} weight="bold" />} style={{ flex: 1, height: 40 }} testID={`toggle-manager-${m.id}`} />
          </Row>
        </Card>
      ))}

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
              <Txt display weight="semibold" size={type.xl}>{editing ? "Edit Manager" : "New Manager"}</Txt>
              <Pressable onPress={() => setShow(false)} hitSlop={10} testID="manager-modal-close"><X size={22} color={colors.onSurface} /></Pressable>
            </Row>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
              {!editing && <>
                <FormField label="Full Name" testID="mf-name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <FormField label="Phone (10 digits)" testID="mf-phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v.replace(/[^0-9]/g, "").slice(0, 10) })} keyboardType="phone-pad" />
              </>}
              {editing && (
                <View style={{ marginBottom: spacing.md }}>
                  <Txt color={colors.muted} size={type.sm}>Editing permissions for</Txt>
                  <Txt weight="semibold" size={type.lg}>{editing.name} (+91 {editing.phone})</Txt>
                </View>
              )}
              <Row style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
                <ShieldCheck size={18} color={colors.brandPrimary} weight="fill" />
                <Txt display weight="semibold" size={type.lg}>Permissions</Txt>
              </Row>
              {MANAGER_MODULES.map((k) => (
                <Pressable key={k} onPress={() => togglePerm(k)} style={styles.permRow} testID={`mf-perm-${k}`}>
                  <View style={[styles.checkbox, form.permissions[k] && styles.checkboxOn]}>
                    {form.permissions[k] && <Check size={14} color={colors.onBrandPrimary} weight="bold" />}
                  </View>
                  <Txt weight="medium" style={{ flex: 1, textTransform: "capitalize" }}>{k}</Txt>
                </Pressable>
              ))}
            </ScrollView>
            <Row style={{ gap: spacing.md, marginTop: spacing.sm }}>
              <Button title="Cancel" variant="outline" onPress={() => setShow(false)} style={{ flex: 1 }} />
              <Button title="Save" loading={busy} onPress={save} style={{ flex: 1 }} testID="manager-save-button" />
            </Row>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------- Agents (admin only) ----------
export function AgentsTab() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", employee_id: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setItems(await api.get("/admin/agents")); } catch {} }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.name.trim() || !form.phone.trim()) return toast.show("Name & phone required", "error");
    setBusy(true);
    try {
      await api.post("/admin/agents", { name: form.name.trim(), phone: form.phone.trim(), employee_id: form.employee_id.trim() });
      toast.show("Agent created", "success");
      setShow(false); setForm({ name: "", phone: "", employee_id: "" });
      load();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };
  const toggleSuspend = async (a: any) => { await api.put(`/admin/agents/${a.id}/toggle`); load(); };

  return (
    <View>
      <Button title="Add Agent" icon={<UserPlus size={18} color={colors.onBrandPrimary} weight="bold" />} onPress={() => setShow(true)} testID="add-agent-button" style={{ marginBottom: spacing.md, height: 44 }} />
      {items.map((a) => (
        <Card key={a.id} style={{ marginBottom: spacing.md }} testID={`agent-${a.id}`}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Row style={{ gap: spacing.sm }}>
                <Txt weight="semibold" size={type.lg}>{a.name}</Txt>
                {a.suspended ? <Badge label="Suspended" color={colors.error} bg="#F6E4E4" /> : <Badge label="Active" />}
              </Row>
              <Txt color={colors.muted} size={type.sm}>+91 {a.phone} {a.employee_id ? `· ${a.employee_id}` : ""}</Txt>
              <Txt color={colors.muted} size={type.sm}>Delivered: {a.delivered_count ?? 0}</Txt>
            </View>
          </Row>
          <Button title={a.suspended ? "Activate" : "Suspend"} variant="outline" onPress={() => toggleSuspend(a)} style={{ marginTop: spacing.sm, height: 38 }} testID={`agent-toggle-${a.id}`} />
        </Card>
      ))}

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
              <Txt display weight="semibold" size={type.xl}>New Agent</Txt>
              <Pressable onPress={() => setShow(false)} hitSlop={10} testID="agent-modal-close"><X size={22} color={colors.onSurface} /></Pressable>
            </Row>
            <FormField label="Full Name" testID="af-name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <FormField label="Phone" testID="af-phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v.replace(/[^0-9]/g, "").slice(0, 10) })} keyboardType="phone-pad" />
            <FormField label="Employee ID (optional)" testID="af-emp" value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} />
            <Row style={{ gap: spacing.md, marginTop: spacing.sm }}>
              <Button title="Cancel" variant="outline" onPress={() => setShow(false)} style={{ flex: 1 }} />
              <Button title="Create" loading={busy} onPress={add} style={{ flex: 1 }} testID="agent-save-button" />
            </Row>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------- Referrals (read-only) ----------
export function ReferralsTab() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { (async () => { try { setItems(await api.get("/admin/referrals")); } catch {} })(); }, []);
  return (
    <View>
      {items.length === 0 && <Txt color={colors.muted}>No referrals yet.</Txt>}
      {items.map((r) => (
        <Card key={r.code} style={{ marginBottom: spacing.md }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt display weight="semibold">{r.code}</Txt>
            <Badge label={`₹${r.reward_amount} earned`} />
          </Row>
          <Row style={{ justifyContent: "space-between", marginTop: spacing.sm }}>
            <Txt color={colors.muted} size={type.sm}>Signups: {r.signups}</Txt>
            <Txt color={colors.muted} size={type.sm}>Paid: {r.paid_orders}</Txt>
          </Row>
        </Card>
      ))}
    </View>
  );
}

// ---------- AI Forecast (admin only) ----------
export function AITab() {
  const [ai, setAi] = useState<any>(null);
  useEffect(() => { (async () => { try { setAi(await api.get("/admin/ai-predictions")); } catch {} })(); }, []);
  if (!ai) return <Loading />;
  return (
    <Card style={{ backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary }}>
      <Row style={{ gap: spacing.sm }}><Sparkle size={20} color={colors.brandPrimary} weight="fill" /><Txt display weight="semibold" size={type.lg}>Demand Forecast</Txt></Row>
      <Txt color={colors.onSurfaceTertiary} style={{ marginTop: spacing.md, lineHeight: 22 }}>{ai.forecast}</Txt>
      <Row style={{ gap: spacing.xl, marginTop: spacing.lg }}>
        <View><Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>{ai.customers}</Txt><Txt size={type.sm} color={colors.muted}>Customers</Txt></View>
        <View><Txt display weight="semibold" size={type.xl} color={colors.brandPrimary}>{ai.active_subscriptions}</Txt><Txt size={type.sm} color={colors.muted}>Active subs</Txt></View>
      </Row>
    </Card>
  );
}

// ---------- Tickets ----------
export function TicketsTab() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => { try { setItems(await api.get("/admin/tickets")); } catch {} }, []);
  useEffect(() => { load(); }, [load]);
  const resolve = async (id: string) => { await api.put(`/admin/tickets/${id}/status?status=resolved`); toast.show("Resolved", "success"); load(); };
  return (
    <View>
      {items.length === 0 ? <Txt color={colors.muted}>No tickets.</Txt> : items.map((t) => (
        <Card key={t.id} style={{ marginBottom: spacing.md }} testID={`ticket-${t.id}`}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt weight="semibold" style={{ flex: 1 }}>{t.subject}</Txt>
            <Badge label={t.status} color={t.status === "resolved" ? colors.success : colors.warning} bg={t.status === "resolved" ? "#E3F0E8" : "#FBEEDC"} />
          </Row>
          <Txt color={colors.muted} size={type.sm} style={{ marginTop: 4 }}>{t.user_name} · {t.category}</Txt>
          <Txt color={colors.onSurfaceTertiary} size={type.sm} style={{ marginTop: spacing.sm }}>{t.message}</Txt>
          {t.status !== "resolved" && <Button title="Resolve" onPress={() => resolve(t.id)} style={{ marginTop: spacing.sm, height: 38 }} testID={`resolve-${t.id}`} />}
        </Card>
      ))}
    </View>
  );
}

// ---------- Small atoms ----------
export function FormField({ label, value, onChange, keyboardType, testID, autoCaps }: { label: string; value: string; onChange: (v: string) => void; keyboardType?: any; testID?: string; autoCaps?: boolean }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Txt size={type.sm} color={colors.muted} style={{ marginBottom: 4 }}>{label}</Txt>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCapitalize={autoCaps ? "characters" : "none"}
        style={styles.input}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

// ---------- Banners (Home page banners) ----------
export function BannersTab() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.get("/admin/banners")); } catch (e: any) { toast.show(e.message, "error"); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (id: string) => {
    try { await api.put(`/admin/banners/${id}/toggle`); load(); }
    catch (e: any) { toast.show(e.message, "error"); }
  };
  const remove = async (id: string) => {
    try { await api.del(`/admin/banners/${id}`); toast.show("Banner deleted", "info"); load(); }
    catch (e: any) { toast.show(e.message, "error"); }
  };

  if (loading) return <Loading />;
  return (
    <View>
      <Button
        title="Add Banner"
        icon={<Plus size={18} color={colors.onBrandPrimary} weight="bold" />}
        onPress={() => setCreating(true)}
        testID="add-banner-button"
        style={{ marginBottom: spacing.md, height: 44 }}
      />
      {items.length === 0 && (
        <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <Megaphone size={36} color={colors.muted} />
          <Txt color={colors.muted} style={{ marginTop: spacing.sm }}>No banners yet. Add one to promote on the home page.</Txt>
        </Card>
      )}
      {items.map((b) => (
        <Card key={b.id} style={{ marginBottom: spacing.md }} testID={`banner-${b.id}`}>
          {!!b.image && (
            <RNImage source={{ uri: b.image }} style={styles.bannerPreview} resizeMode="cover" />
          )}
          <Row style={{ justifyContent: "space-between", marginTop: spacing.sm }}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              {!!b.badge && (
                <Badge label={b.badge} color={colors.onWarning} bg={colors.warning} />
              )}
              <Txt weight="semibold" size={type.lg} style={{ marginTop: 4 }}>{b.title || "(Untitled)"}</Txt>
              {!!b.subtitle && <Txt color={colors.muted} size={type.sm} numberOfLines={2}>{b.subtitle}</Txt>}
              {!!b.cta_label && <Txt color={colors.brandPrimary} size={type.sm} style={{ marginTop: 4 }}>CTA: {b.cta_label} → {b.cta_route || "—"}</Txt>}
              <Txt color={colors.muted} size={type.sm} style={{ marginTop: 2 }}>Order #{b.sort_order ?? 0}</Txt>
            </View>
            <Badge label={b.active ? "Active" : "Hidden"} color={b.active ? colors.success : colors.muted} bg={b.active ? "#E3F0E8" : colors.surfaceTertiary} />
          </Row>
          <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title="Edit" variant="outline" onPress={() => setEditing(b)} style={{ flex: 1, height: 38 }} testID={`edit-banner-${b.id}`} />
            <Button title={b.active ? "Hide" : "Show"} variant="outline" onPress={() => toggle(b.id)} style={{ flex: 1, height: 38 }} testID={`toggle-banner-${b.id}`} />
            <Button title="Delete" variant="outline" onPress={() => remove(b.id)} style={{ flex: 1, height: 38 }} testID={`delete-banner-${b.id}`} />
          </Row>
        </Card>
      ))}

      <BannerFormModal
        visible={creating || !!editing}
        initial={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </View>
  );
}

function BannerFormModal({ visible, initial, onClose, onSaved }: { visible: boolean; initial: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(initial || { title: "", subtitle: "", image: "", cta_label: "Shop Now", cta_route: "/catalog?type=milk", badge: "", active: true, sort_order: 0 });
  }, [initial]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title?.trim() && !form.image) return toast.show("Add at least a title or image", "error");
    setBusy(true);
    try {
      const payload = { ...form, sort_order: Number(form.sort_order) || 0, active: !!form.active };
      if (initial?.id) await api.put(`/admin/banners/${initial.id}`, payload);
      else await api.post("/admin/banners", payload);
      toast.show("Banner saved", "success");
      onSaved();
    } catch (e: any) { toast.show(e.message, "error"); } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modal}>
          <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
            <Txt display weight="semibold" size={type.xl}>{initial?.id ? "Edit Banner" : "New Banner"}</Txt>
            <Pressable onPress={onClose} hitSlop={10} testID="banner-modal-close"><X size={22} color={colors.onSurface} /></Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
            <ImageUploadField
              label="Banner image"
              testID="bf-image"
              value={form.image || ""}
              onChange={(uri) => set("image", uri)}
              aspect={[16, 9]}
              hint="Landscape works best (16:9)"
            />
            <FormField label="Title" testID="bf-title" value={form.title} onChange={(v) => set("title", v)} />
            <FormField label="Subtitle" testID="bf-subtitle" value={form.subtitle} onChange={(v) => set("subtitle", v)} />
            <FormField label="Badge (e.g. LIMITED OFFER)" testID="bf-badge" value={form.badge} onChange={(v) => set("badge", v)} autoCaps />
            <FormField label="Button label" testID="bf-cta-label" value={form.cta_label} onChange={(v) => set("cta_label", v)} />
            <FormField label="Button route (e.g. /catalog?type=milk)" testID="bf-cta-route" value={form.cta_route} onChange={(v) => set("cta_route", v)} />
            <FormField label="Sort order (lower = first)" testID="bf-sort" value={String(form.sort_order ?? 0)} onChange={(v) => set("sort_order", v)} keyboardType="numeric" />
            <Row style={{ justifyContent: "space-between", marginVertical: spacing.sm }}>
              <Txt weight="medium">Active (visible to customers)</Txt>
              <Switch testID="bf-active" value={!!form.active} onValueChange={(v) => set("active", v)} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} />
            </Row>
          </ScrollView>
          <Row style={{ gap: spacing.md, marginTop: spacing.sm }}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save" onPress={save} loading={busy} style={{ flex: 1 }} testID="banner-save-button" />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "90%" },
  input: { height: 46, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceSecondary, fontFamily: font.medium, color: colors.onSurface },
  typePill: { flex: 1, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  typePillActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  permRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  permPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandSecondary },
  bannerPreview: { width: "100%", height: 140, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
});
