import { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { MapPin, X, ArrowRight } from "phosphor-react-native";
import { useAuth } from "@/src/auth";
import { useDeviceLocation } from "@/src/hooks/use-device-location";
import { nearestAddress, formatDistance } from "@/src/utils/geo";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt } from "@/src/components/ui";

const FAR_THRESHOLD_M = 500;

// Session-scoped dismissal (in-memory only; resets on app restart)
let sessionDismissed = false;

export function LocationBanner() {
  const router = useRouter();
  const toast = useToast();
  const { user, refresh } = useAuth();
  const { loc } = useDeviceLocation(true);
  const [dismissed, setDismissed] = useState(sessionDismissed);
  const [switching, setSwitching] = useState(false);

  const result = useMemo(() => {
    if (!loc || !user?.addresses?.length) return null;
    return nearestAddress({ lat: loc.lat, lng: loc.lng }, user.addresses);
  }, [loc, user?.addresses]);

  // Auto-dismiss if user has no addresses with coords yet -- silently encourage save by skipping
  if (dismissed || !loc) return null;

  // Case A: nearest > 500m -> suggest adding a new address
  if (result && result.meters > FAR_THRESHOLD_M) {
    return (
      <View testID="loc-banner-far" style={[styles.wrap, styles.warn]}>
        <View style={styles.iconCircle}>
          <MapPin size={18} color={colors.brandPrimary} weight="fill" />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" size={type.base}>You appear ~{formatDistance(result.meters)} away</Txt>
          <Txt color={colors.muted} size={type.sm} numberOfLines={2}>
            From your saved address. Add this location?
          </Txt>
        </View>
        <Pressable
          testID="loc-banner-add"
          onPress={() => router.push({ pathname: "/addresses", params: { auto: "1" } })}
          style={styles.cta}
        >
          <Txt weight="semibold" size={type.sm} color={colors.onBrandPrimary}>Add</Txt>
          <ArrowRight size={14} color={colors.onBrandPrimary} weight="bold" />
        </Pressable>
        <Pressable testID="loc-banner-dismiss" hitSlop={10} onPress={() => { sessionDismissed = true; setDismissed(true); }} style={styles.close}>
          <X size={16} color={colors.muted} weight="bold" />
        </Pressable>
      </View>
    );
  }

  // Case B: nearest is within 500m AND it's not the default -> suggest switching default
  if (
    result &&
    result.meters <= FAR_THRESHOLD_M &&
    user?.default_address_id &&
    result.addr.id !== user.default_address_id
  ) {
    const switchDefault = async () => {
      try {
        setSwitching(true);
        await api.put(`/addresses/${result.addr.id}/default`);
        toast.show(`Default set to ${result.addr.label}`, "success");
        sessionDismissed = true;
        setDismissed(true);
        await refresh();
      } catch (e: any) {
        toast.show(e.message, "error");
      } finally {
        setSwitching(false);
      }
    };
    return (
      <View testID="loc-banner-switch" style={[styles.wrap, styles.info]}>
        <View style={styles.iconCircle}>
          <MapPin size={18} color={colors.brandPrimary} weight="fill" />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" size={type.base}>You're at {result.addr.label}</Txt>
          <Txt color={colors.muted} size={type.sm} numberOfLines={2}>
            Switch default delivery address?
          </Txt>
        </View>
        <Pressable testID="loc-banner-switch-btn" disabled={switching} onPress={switchDefault} style={styles.cta}>
          <Txt weight="semibold" size={type.sm} color={colors.onBrandPrimary}>Switch</Txt>
        </Pressable>
        <Pressable testID="loc-banner-dismiss" hitSlop={10} onPress={() => { sessionDismissed = true; setDismissed(true); }} style={styles.close}>
          <X size={16} color={colors.muted} weight="bold" />
        </Pressable>
      </View>
    );
  }

  // Case C: user has no addresses with coords yet — gently suggest saving
  if (!result && (user?.addresses?.length || 0) > 0) {
    return (
      <View testID="loc-banner-update" style={[styles.wrap, styles.info]}>
        <View style={styles.iconCircle}>
          <MapPin size={18} color={colors.brandPrimary} weight="fill" />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" size={type.base}>Pin your address</Txt>
          <Txt color={colors.muted} size={type.sm} numberOfLines={2}>
            Save coordinates for accurate delivery
          </Txt>
        </View>
        <Pressable
          testID="loc-banner-update-btn"
          onPress={() => router.push("/addresses" as any)}
          style={styles.cta}
        >
          <Txt weight="semibold" size={type.sm} color={colors.onBrandPrimary}>Update</Txt>
        </Pressable>
        <Pressable testID="loc-banner-dismiss" hitSlop={10} onPress={() => { sessionDismissed = true; setDismissed(true); }} style={styles.close}>
          <X size={16} color={colors.muted} weight="bold" />
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  warn: { backgroundColor: "#FBEEDC", borderColor: "#E8D2A8" },
  info: { backgroundColor: "#EAF1E6", borderColor: colors.brandSecondary },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  close: { padding: 4 },
});
