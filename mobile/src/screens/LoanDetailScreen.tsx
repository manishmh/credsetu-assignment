import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, Loan } from "../api/client";
import { fmtDate, inr, theme } from "../theme";
import { Button, Card, StatusPill } from "../components/ui";

export function LoanDetailScreen({ loanId, onBack, onChanged }: { loanId: string; onBack: () => void; onChanged: () => void }) {
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.loan(loanId);
      setLoan(res.loan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load loan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  const repay = async () => {
    setBusy(true);
    try {
      const res = await api.repayLoan(loanId);
      setLoan(res.loan);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Repayment failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmRepay = () => {
    Alert.alert("Mark as repaid?", "This records that your friend repaid the full amount.", [
      { text: "Cancel", style: "cancel" },
      { text: "Mark repaid", style: "default", onPress: repay },
    ]);
  };

  const attachReceipt = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo permission is needed to attach a receipt.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setUploading(true);
    setError(null);
    try {
      const name = asset.fileName ?? `receipt-${Date.now()}.jpg`;
      const updated = await api.uploadReceipt(loanId, asset.uri, name, asset.mimeType ?? "image/jpeg");
      setLoan(updated);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receipt upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (error && !loan) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.colors.danger, marginBottom: 12 }}>{error}</Text>
        <Button title="Back" onPress={onBack} />
      </View>
    );
  }

  if (!loan) return null;
  const receipt = api.receiptUrl(loan.receiptUrl);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.back} onPress={onBack}>‹ Back</Text>
      <Card>
        <View style={styles.top}>
          <Text style={styles.name}>{loan.friendName}</Text>
          <StatusPill status={loan.status} overdue={loan.overdue} />
        </View>
        <Text style={styles.amount}>{inr(loan.amount)}</Text>
        <Row k="Due date" v={fmtDate(loan.dueDate)} />
        <Row k="Status" v={loan.status === "REPAID" ? "Repaid" : loan.overdue ? "Pending — overdue" : "Pending"} />
        {loan.repaidAt && <Row k="Repaid on" v={new Date(loan.repaidAt).toLocaleString("en-IN")} />}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {loan.status === "PENDING" ? (
          <Button title="Mark as repaid" onPress={confirmRepay} loading={busy} />
        ) : (
          <Text style={styles.repaidNote}>This loan is fully repaid. No further action needed.</Text>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.section}>Receipt</Text>
        {receipt ? (
          <Image source={{ uri: receipt }} style={styles.receipt} resizeMode="contain" />
        ) : (
          <Text style={styles.muted}>No receipt attached.</Text>
        )}
        <View style={{ height: 10 }} />
        <Button title={uploading ? "Uploading…" : "Attach receipt photo"} secondary onPress={attachReceipt} disabled={uploading} />
      </Card>
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: theme.colors.bg },
  back: { color: theme.colors.accent, fontWeight: "700", fontSize: 16, marginVertical: 8 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  amount: { fontSize: 30, fontWeight: "800", marginVertical: 8, color: theme.colors.text },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  k: { color: theme.colors.muted },
  v: { fontWeight: "600", color: theme.colors.text },
  error: { color: theme.colors.danger, marginVertical: 8 },
  repaidNote: { color: theme.colors.success, fontWeight: "600", marginTop: 8 },
  section: { fontSize: 16, fontWeight: "700", marginBottom: 8, color: theme.colors.text },
  muted: { color: theme.colors.muted },
  receipt: { width: "100%", height: 260, borderRadius: 10, backgroundColor: theme.colors.bg },
});
