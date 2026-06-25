import { useState } from "react";
import { View, StyleSheet, Pressable, TextInput, Image as RNImage } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageSquare, UploadSimple, Trash, Link as LinkIcon, X } from "phosphor-react-native";
import { colors, spacing, radius, type, font } from "@/src/theme";
import { Txt, Row, Button } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";

type Props = {
  label?: string;
  value: string;                // base64 data URI OR https URL
  onChange: (uri: string) => void;
  aspect?: [number, number];
  testID?: string;
  hint?: string;
};

const MAX_BYTES = 1_500_000; // ~1.5MB upper bound for base64 string (post-compression target)

export default function ImageUploadField({
  label = "Image",
  value,
  onChange,
  aspect = [4, 3],
  testID,
  hint,
}: Props) {
  const toast = useToast();
  const [mode, setMode] = useState<"upload" | "url">(value && value.startsWith("http") ? "url" : "upload");
  const [busy, setBusy] = useState(false);
  const [showUrlField, setShowUrlField] = useState(mode === "url");

  const pickImage = async () => {
    try {
      setBusy(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        toast.show("Photo permission needed", "error");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      const b64 = asset.base64;
      if (!b64) {
        toast.show("Couldn't read image bytes", "error");
        return;
      }
      const mime = asset.mimeType || (asset.uri?.endsWith(".png") ? "image/png" : "image/jpeg");
      const dataUri = `data:${mime};base64,${b64}`;
      if (dataUri.length > MAX_BYTES) {
        toast.show("Image too large — try a smaller crop or lower quality", "error");
        return;
      }
      onChange(dataUri);
      setMode("upload");
      setShowUrlField(false);
    } catch (e: any) {
      toast.show(e?.message || "Image picker failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    onChange("");
  };

  const hasImage = !!value;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Txt size={type.sm} color={colors.muted} style={{ marginBottom: 6 }}>{label}</Txt>

      {hasImage ? (
        <View style={styles.previewBox}>
          <RNImage source={{ uri: value }} style={styles.previewImg} resizeMode="cover" />
          <Pressable onPress={clear} hitSlop={10} style={styles.removeBtn} testID={testID ? `${testID}-clear` : undefined}>
            <Trash size={16} color={colors.onBrandPrimary} weight="bold" />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={pickImage} style={styles.placeholder} disabled={busy} testID={testID ? `${testID}-pick` : undefined}>
          <ImageSquare size={32} color={colors.muted} />
          <Txt size={type.sm} color={colors.muted} style={{ marginTop: 4 }}>
            {busy ? "Loading…" : "Tap to upload from device"}
          </Txt>
          {!!hint && <Txt size={type.sm} color={colors.muted} style={{ marginTop: 2, opacity: 0.7 }}>{hint}</Txt>}
        </Pressable>
      )}

      <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <Button
          title={hasImage ? "Replace" : "Upload"}
          icon={<UploadSimple size={16} color={colors.onBrandPrimary} weight="bold" />}
          onPress={pickImage}
          loading={busy}
          style={{ flex: 1, height: 40 }}
          testID={testID ? `${testID}-upload` : undefined}
        />
        <Button
          title={showUrlField ? "Hide URL" : "Use URL"}
          variant="outline"
          icon={<LinkIcon size={16} color={colors.brandPrimary} weight="bold" />}
          onPress={() => setShowUrlField((s) => !s)}
          style={{ flex: 1, height: 40 }}
        />
      </Row>

      {showUrlField && (
        <View style={styles.urlRow}>
          <TextInput
            testID={testID ? `${testID}-url` : undefined}
            placeholder="Paste https:// image URL"
            placeholderTextColor={colors.muted}
            value={value && value.startsWith("http") ? value : ""}
            onChangeText={onChange}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.urlInput}
          />
          {value && value.startsWith("http") && (
            <Pressable onPress={clear} hitSlop={8}>
              <X size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  previewBox: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    position: "relative",
  },
  previewImg: {
    width: "100%",
    height: 170,
    backgroundColor: colors.surfaceTertiary,
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    height: 140,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    marginTop: spacing.sm,
  },
  urlInput: {
    flex: 1,
    height: 44,
    fontFamily: font.regular,
    fontSize: type.base,
    color: colors.onSurface,
  },
});
