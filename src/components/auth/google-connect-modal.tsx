import { useEffect } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGoogleAuth } from "@/context/google-auth-context";
import { useThemePreference } from "@/context/theme-context";
import { colors } from "@/theme/colors";

type GoogleConnectModalProps = {
  visible: boolean;
  onClose: () => void;
  onConnected?: () => void;
};

export function GoogleConnectModal({ visible, onClose, onConnected }: GoogleConnectModalProps) {
  const { signIn, signingIn, error, clearError, isGoogleAuthAvailable } = useGoogleAuth();
  const { mode } = useThemePreference();
  const dark = mode === "dark";
  const palette = dark ? colors.dark : colors.light;

  useEffect(() => {
    if (visible) clearError();
  }, [visible, clearError]);

  const connect = async () => {
    try {
      await signIn();
      onConnected?.();
    } catch {
      // The error is displayed inside this modal; local app use remains unaffected.
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!signingIn) onClose(); }}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Pressable disabled={signingIn} onPress={onClose} style={styles.close} accessibilityLabel="Close Google connection">
            <MaterialCommunityIcons name="close" size={22} color={palette.textMuted} />
          </Pressable>

          <View style={[styles.googleMark, { backgroundColor: dark ? "#243447" : "#EEF5FF" }]}>
            <Text style={styles.googleLetter}>G</Text>
          </View>
          <Text style={[styles.title, { color: palette.text }]}>Connect with Google</Text>
          <Text style={[styles.description, { color: palette.textMuted }]}>
            Google is optional. Connect to enable BudgetNest backup and restore with your Google Drive. Your everyday budgeting features continue to work without signing in.
          </Text>

          {!isGoogleAuthAvailable ? (
            <View style={[styles.infoBox, { backgroundColor: dark ? "#243447" : "#EEF5FF" }]}>
              <Text style={[styles.infoText, { color: palette.text }]}>
                Google Sign-In needs a BudgetNest development build. Expo Go does not include the required native module. You can continue using all local features without Google.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: palette.dangerSoft }]}>
              <Text style={[styles.errorText, { color: palette.primary }]}>{error}</Text>
            </View>
          ) : null}

          {isGoogleAuthAvailable ? (
            <Pressable disabled={signingIn} onPress={() => void connect()} style={[styles.connectButton, { backgroundColor: palette.primary, opacity: signingIn ? 0.7 : 1 }]}>
              {signingIn ? <ActivityIndicator color={palette.onPrimary} /> : <MaterialCommunityIcons name="google" size={19} color={palette.onPrimary} />}
              <Text style={[styles.connectText, { color: palette.onPrimary }]}>{signingIn ? "Connecting…" : "Connect with Google"}</Text>
            </Pressable>
          ) : null}
          <Pressable disabled={signingIn} onPress={onClose} style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: palette.textMuted }]}>{isGoogleAuthAvailable ? "Maybe later" : "Continue"}</Text>
          </Pressable>
          <Text style={[styles.privacyNote, { color: palette.textMuted }]}>No Google connection is needed to use BudgetNest locally.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", justifyContent: "center", alignItems: "center", padding: 22 },
  card: { width: "100%", maxWidth: 410, borderRadius: 24, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 20, alignItems: "center" },
  close: { position: "absolute", top: 13, right: 13, padding: 5, zIndex: 1 },
  googleMark: { width: 58, height: 58, borderRadius: 19, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  googleLetter: { fontSize: 28, fontWeight: "900", color: "#4285F4" },
  title: { fontSize: 21, fontWeight: "900", textAlign: "center" },
  description: { fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 },
  infoBox: { width: "100%", padding: 12, borderRadius: 12, marginTop: 14 },
  infoText: { fontSize: 12, lineHeight: 18 },
  errorBox: { width: "100%", padding: 12, borderRadius: 12, marginTop: 14 },
  errorText: { fontSize: 12, lineHeight: 18 },
  connectButton: { width: "100%", minHeight: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 20 },
  connectText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  cancelButton: { padding: 12, marginTop: 2 },
  cancelText: { fontSize: 13, fontWeight: "700" },
  privacyNote: { fontSize: 10, textAlign: "center", lineHeight: 15, marginTop: 2 },
});