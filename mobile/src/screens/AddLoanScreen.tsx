import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { api } from "../api/client";
import { fmtDate, theme, todayISO } from "../theme";
import { Button, Card, Field, TextBox } from "../components/ui";

export function AddLoanScreen({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [friendName, setFriendName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!friendName.trim()) e.friendName = "Friend's name is required.";
    const amt = Number(amount);
    if (!amount.trim() || !Number.isFinite(amt)) e.amount = "Enter a valid amount.";
    else if (amt <= 0) e.amount = "Amount must be greater than zero.";
    else if (amt > 1_000_000_000) e.amount = "Amount is too large.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) e.dueDate = "Pick a valid due date.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.createLoan({ friendName: friendName.trim(), amount: amount.trim(), dueDate });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create loan");
    } finally {
      setBusy(false);
    }
  };

  const onPick = (_ev: unknown, d?: Date) => {
    setShowPicker(Platform.OS === "ios");
    if (d) setDueDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Add loan</Text>
      <Card>
        <Field label="Friend's name" error={errors.friendName}>
          <TextBox value={friendName} onChangeText={setFriendName} placeholder="e.g. Asha" maxLength={100} />
        </Field>
        <Field label="Amount (INR)" error={errors.amount}>
          <TextBox value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1500.00" />
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          <TouchableOpacity onPress={() => setShowPicker(true)} accessibilityRole="button">
            <View style={styles.dateBox}>
              <Text style={styles.dateText}>{fmtDate(dueDate)}</Text>
              <Text style={styles.dateHint}>Change</Text>
            </View>
          </TouchableOpacity>
        </Field>
        {showPicker && (
          <DateTimePicker value={new Date(`${dueDate}T00:00:00`)} mode="date" display="default" onChange={onPick} />
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button title="Save loan" onPress={submit} loading={busy} />
        <View style={{ height: 8 }} />
        <Button title="Cancel" secondary onPress={onCancel} disabled={busy} />
        <Text style={styles.note}>Tip: use a past due date to see overdue highlighting on the dashboard.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg },
  title: { fontSize: theme.fontSize.title, fontWeight: "800", marginVertical: 12, color: theme.colors.text },
  dateBox: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, flexDirection: "row", justifyContent: "space-between", backgroundColor: "#fff" },
  dateText: { fontSize: 16, color: theme.colors.text },
  dateHint: { color: theme.colors.accent, fontWeight: "700" },
  error: { color: theme.colors.danger, marginBottom: 8 },
  note: { color: theme.colors.muted, fontSize: 12, marginTop: 12, textAlign: "center" },
});
