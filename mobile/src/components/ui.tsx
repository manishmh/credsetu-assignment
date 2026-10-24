import React from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { theme } from "../theme";

export function Button({ title, onPress, disabled, loading, danger, secondary }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean; danger?: boolean; secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={[styles.btn, secondary && styles.secondary, danger && styles.danger, (disabled || loading) && styles.disabled]}
    >
      {loading ? <ActivityIndicator color={secondary ? theme.colors.accent : "#fff"} /> : (
        <Text style={[styles.btnText, secondary && styles.secondaryText]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function TextBox(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={theme.colors.muted} style={[styles.input, props.editable === false && styles.disabledInput]} {...props} />;
}

export function StatusPill({ status, overdue }: { status: "PENDING" | "REPAID"; overdue: boolean }) {
  const label = status === "REPAID" ? "Repaid" : overdue ? "Overdue" : "Pending";
  const bg = status === "REPAID" ? theme.colors.successSoft : overdue ? theme.colors.dangerSoft : theme.colors.warnSoft;
  const fg = status === "REPAID" ? theme.colors.success : overdue ? theme.colors.danger : theme.colors.warn;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: theme.colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  secondary: { backgroundColor: theme.colors.accentSoft },
  danger: { backgroundColor: theme.colors.danger },
  disabled: { opacity: 0.55 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryText: { color: theme.colors.accent },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius,
    padding: theme.pad,
    ...Platform.select({
      web: { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } as object,
      default: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 } as object,
    }),
  },
  label: { fontSize: 13, fontWeight: "600", color: theme.colors.muted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: theme.colors.text, backgroundColor: "#fff" },
  disabledInput: { backgroundColor: theme.colors.bg },
  error: { color: theme.colors.danger, fontSize: 13, marginTop: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  pillText: { fontSize: 12, fontWeight: "700" },
});
