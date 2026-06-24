import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";

export type DeviceLocation = {
  lat: number;
  lng: number;
  area_name?: string;
};

export function useDeviceLocation(autoFetch = true) {
  const [loc, setLoc] = useState<DeviceLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const triedRef = useRef(false);

  const fetchNow = useCallback(async (): Promise<DeviceLocation | null> => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status !== "granted") {
        setError("Location permission denied");
        setLoading(false);
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      let area_name = "";
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (places && places[0]) {
          const p = places[0];
          area_name = [p.name, p.street, p.district, p.city || p.subregion, p.region]
            .filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .slice(0, 3)
            .join(", ");
        }
      } catch {}
      const out: DeviceLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        area_name,
      };
      setLoc(out);
      setLoading(false);
      return out;
    } catch (e: any) {
      setError(e?.message || "Could not get location");
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!autoFetch || triedRef.current) return;
    triedRef.current = true;
    // On web, browser permission prompt is intrusive — only auto-fetch on native
    if (Platform.OS === "web") return;
    fetchNow();
  }, [autoFetch, fetchNow]);

  return { loc, loading, error, permission, fetchNow };
}
