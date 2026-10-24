import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, Loan } from "../api/client";
import { fmtDate, inr, theme } from "../theme";
import { Button, Card, StatusPill } from "../components/ui";

interface PendingReceipt {
  uri: string;
  name: string;
  mime: string;
}

function receiptName(asset: { fileName?: string | null; mimeType?: string | null; uri: string }): { name: string; mime: string } {
  const mime = asset.mimeType ?? "image/jpeg";
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "application/pdf" ? "pdf" : "jpg";
  return { name: asset.fileName ?? `receipt-${Date.now()}.${ext}`, mime };
}

export function LoanDetailScreen({ loanId, onBack, onChanged }: { loanId: string; onBack: () => void; onChanged: () => void }) {
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<PendingReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  // In-app two-step confirmation: React Native Web's Alert.alert() is a no-op,
  // so the confirm dialog must be real UI on every platform.
  const repay = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.repayLoan(loanId);
      setLoan(res.loan);
      setConfirming(false);
      setNotice("Marked as repaid.");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Repayment failed");
    } finally {
      setBusy(false);
    }
  };

  const pickReceipt = async () => {
    setError(null);
    setNotice(null);
    try {
      // Native only: the web picker needs no media-library permission.
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setError("Photo permission is needed to attach a receipt.");
          return;
        }
      }
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8 });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      const { name, mime } = receiptName(asset);
      setPending({ uri: asset.uri, name, mime });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the photo picker");
    }
  };

  const uploadPending = async () => {
    if (!pending || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await api.uploadReceipt(loanId, pending.uri, pending.name, pending.mime);
      setLoan(updated);
      setPending(null);
      setNotice("Receipt uploaded.");
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
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
        {loan.status === "PENDING" ? (
          confirming ? (
            <>
              <Text style={styles.confirmText}>Mark this loan as fully repaid?</Text>
              <Button title="Confirm repayment" onPress={repay} loading={busy} />
              <View style={{ height: 8 }} />
              <Button title="Cancel" secondary onPress={() => setConfirming(false)} disabled={busy} />
            </>
          ) : (
            <Button title="Mark as repaid" onPress={() => { setError(null); setNotice(null); setConfirming(true); }} />
          )
        ) : (
          <Text style={styles.repaidNote}>This loan is fully repaid. No further action needed.</Text>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.section}>Receipt</Text>
        {pending ? (
          <>
            <Text style={styles.muted}>Preview — not uploaded yet.</Text>
            <Image source={{ uri: pending.uri }} style={styles.receipt} resizeMode="contain" />
            <View style={{ height: 10 }} />
            <Button title="Upload this receipt" onPress={uploadPending} loading={uploading} />
            <View style={{ height: 8 }} />
            <Button title="Choose a different photo" secondary onPress={pickReceipt} disabled={uploading} />
          </>
        ) : (
          <>
            {receipt ? (
              <Image source={{ uri: receipt }} style={styles.receipt} resizeMode="contain" />
            ) : (
              <Text style={styles.muted}>No receipt attached.</Text>
            )}
            <View style={{ height: 10 }} />
            <Button title="Attach receipt photo" secondary onPress={pickReceipt} />
          </>
        )}
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
  notice: { color: theme.colors.success, marginVertical: 8, fontWeight: "600" },
  confirmText: { color: theme.colors.text, fontWeight: "600", marginVertical: 8 },
  repaidNote: { color: theme.colors.success, fontWeight: "600", marginTop: 8 },
  section: { fontSize: 16, fontWeight: "700", marginBottom: 8, color: theme.colors.text },
  muted: { color: theme.colors.muted },
  receipt: { width: "100%", height: 260, borderRadius: 10, backgroundColor: theme.colors.bg },
});
