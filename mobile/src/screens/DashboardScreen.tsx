import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Loan, Summary } from "../api/client";
import { fmtDate, inr, theme } from "../theme";
import { Button, Card, StatusPill } from "../components/ui";

export function DashboardScreen({ summary, loans, loading, error, onRefresh, onAdd, onOpen, onLogout }: {
  summary: Summary | null;
  loans: Loan[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onLogout: () => void;
}) {
  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.logout} onPress={onLogout}>Log out</Text>
      </View>

      {error ? (
        <Card style={{ marginBottom: 12 }}>
          <Text style={{ color: theme.colors.danger, marginBottom: 8 }}>{error}</Text>
          <Button title="Retry" onPress={onRefresh} />
        </Card>
      ) : null}

      <Card style={styles.summary}>
        <Text style={styles.summaryTitle}>Outstanding</Text>
        <Text style={styles.outstanding}>{summary ? inr(summary.outstandingAmount) : "—"}</Text>
        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={styles.k}>Total lent</Text>
            <Text style={styles.v}>{summary ? inr(summary.totalLent) : "—"}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.k}>Total repaid</Text>
            <Text style={[styles.v, { color: theme.colors.success }]}>{summary ? inr(summary.totalRepaid) : "—"}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.k}>Overdue</Text>
            <Text style={[styles.v, { color: theme.colors.danger }]}>{summary ? inr(summary.overdueAmount) : "—"}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.k}>Pending / Repaid</Text>
            <Text style={styles.v}>{summary ? `${summary.pendingCount} / ${summary.repaidCount}` : "—"}</Text>
          </View>
        </View>
      </Card>

      <Button title="+ Add loan" onPress={onAdd} />

      <Text style={styles.section}>Loans ({loans.length})</Text>
      {loans.length === 0 && !loading ? (
        <Card>
          <Text style={styles.empty}>No loans yet. Tap “Add loan” to record money you lend a friend.</Text>
        </Card>
      ) : (
        loans.map((l) => (
          <TouchableOpacity key={l.id} onPress={() => onOpen(l.id)} accessibilityRole="button">
            <Card style={[styles.row, l.status === "REPAID" && styles.rowRepaid, l.overdue && styles.rowOverdue]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{l.friendName}</Text>
                <Text style={styles.meta}>Due {fmtDate(l.dueDate)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.amount}>{inr(l.amount)}</Text>
                <StatusPill status={l.status} overdue={l.overdue} />
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 8 },
  title: { fontSize: theme.fontSize.title, fontWeight: "800", color: theme.colors.text },
  logout: { color: theme.colors.accent, fontWeight: "700" },
  summary: { marginBottom: 12 },
  summaryTitle: { color: theme.colors.muted, fontSize: 13, fontWeight: "600" },
  outstanding: { fontSize: 34, fontWeight: "800", color: theme.colors.text, marginVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  cell: { width: "50%", paddingVertical: 6 },
  k: { color: theme.colors.muted, fontSize: 12 },
  v: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  section: { fontSize: 16, fontWeight: "700", marginVertical: 12, color: theme.colors.text },
  row: { marginBottom: 10, flexDirection: "row", alignItems: "center", borderLeftWidth: 4, borderLeftColor: theme.colors.border },
  rowOverdue: { borderLeftColor: theme.colors.danger },
  rowRepaid: { borderLeftColor: theme.colors.success },
  name: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 2 },
  amount: { fontSize: 17, fontWeight: "800", color: theme.colors.text, marginBottom: 4 },
  empty: { color: theme.colors.muted, textAlign: "center", paddingVertical: 12 },
});
