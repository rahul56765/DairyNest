import { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Leaf, ShoppingCart } from "phosphor-react-native";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type, shadow } from "@/src/theme";
import { Txt, Header, Badge, Loading, ChipRow } from "@/src/components/ui";

export default function Catalog() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { type: ptype } = useLocalSearchParams<{ type: string }>();
  const [products, setProducts] = useState<any[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState("All");
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  const title = ptype === "fruit" ? "Fresh Fruits"
    : ptype === "milk" ? "Fresh Milk"
    : ptype === "vegetable" ? "Organic Vegetables"
    : (ptype || "").includes(",") ? "Fruits & Vegetables"
    : "Catalog";

  useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([api.get(`/products?type=${ptype}`), api.get(`/products/categories?type=${ptype}`)]);
        setProducts(p);
        setCats(["All", ...c]);
      } catch {}
      setLoading(false);
    })();
  }, [ptype]);

  const loadCart = useCallback(async () => {
    try {
      const c = await api.get("/cart");
      setCartCount(c.items.reduce((s: number, i: any) => s + i.qty, 0));
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { loadCart(); }, [loadCart]));

  const add = async (p: any) => {
    try {
      await api.post("/cart/add", { product_id: p.id, qty: 1 });
      toast.show(`${p.name} added to cart`, "success");
      loadCart();
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const filtered = cat === "All" ? products : products.filter((p) => p.category === cat);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={title} back right={
        <Pressable testID="catalog-cart-button" onPress={() => router.push("/cart")}>
          <ShoppingCart size={22} color={colors.onSurface} />
          {cartCount > 0 && <View style={styles.cartDot}><Txt size={9} weight="bold" color={colors.onBrandPrimary}>{cartCount}</Txt></View>}
        </Pressable>
      } />
      {loading ? <Loading /> : (
        <>
          <ChipRow options={cats} value={cat} onChange={setCat} testIDPrefix="cat" />
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            numColumns={2}
            columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
            contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing["3xl"], gap: spacing.md }}
            renderItem={({ item }) => (
              <Pressable testID={`product-${item.id}`} style={styles.card} onPress={() => router.push(`/product/${item.id}` as any)}>
                <Image source={{ uri: item.image }} style={styles.img} contentFit="cover" transition={200} />
                {item.organic && <View style={styles.organic}><Leaf size={11} color={colors.onSuccess} weight="fill" /><Txt size={9} weight="semibold" color={colors.onSuccess}>Organic</Txt></View>}
                <View style={{ padding: spacing.md }}>
                  <Txt weight="semibold" numberOfLines={1}>{item.name}</Txt>
                  <Txt color={colors.muted} size={type.sm}>{item.weight}</Txt>
                  <View style={styles.cardFoot}>
                    <Txt display weight="semibold" size={type.lg} color={colors.brandPrimary}>₹{item.price}</Txt>
                    <Pressable testID={`add-${item.id}`} onPress={() => add(item)} style={styles.addBtn} hitSlop={8}>
                      <Plus size={18} color={colors.onBrandPrimary} weight="bold" />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadow.card },
  img: { width: "100%", height: 120, backgroundColor: colors.surfaceTertiary },
  organic: { position: "absolute", top: spacing.sm, left: spacing.sm, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.success, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  cartDot: { position: "absolute", top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
});
