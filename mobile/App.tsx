import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { api, Loan, Summary } from "./src/api/client";
import { clearToken, getToken } from "./src/auth/session";
import { AddLoanScreen } from "./src/screens/AddLoanScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { LoanDetailScreen } from "./src/screens/LoanDetailScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { theme } from "./src/theme";

type Route = { name: "dashboard" } | { name: "add" } | { name: "detail"; id: string };

export default function App() {
  const [booting, setBooting] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [route, setRoute] = useState<Route>({ name: "dashboard" });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, l] = await Promise.all([api.summary(), api.loans()]);
      setSummary(s.summary);
      setLoans(l.loans);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getToken().then((t) => {
      setAuthed(!!t);
      setBooting(false);
      if (t) refresh();
    });
  }, [refresh]);

  const logout = async () => {
    await clearToken();
    setAuthed(false);
    setSummary(null);
    setLoans([]);
    setRoute({ name: "dashboard" });
  };

  if (booting) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {!authed ? (
        <LoginScreen
          onLoggedIn={() => {
            setAuthed(true);
            refresh();
          }}
        />
      ) : route.name === "add" ? (
        <AddLoanScreen
          onDone={() => {
            setRoute({ name: "dashboard" });
            refresh();
          }}
          onCancel={() => setRoute({ name: "dashboard" })}
        />
      ) : route.name === "detail" ? (
        <LoanDetailScreen loanId={route.id} onBack={() => setRoute({ name: "dashboard" })} onChanged={refresh} />
      ) : (
        <DashboardScreen
          summary={summary}
          loans={loans}
          loading={loading}
          error={error}
          onRefresh={refresh}
          onAdd={() => setRoute({ name: "add" })}
          onOpen={(id) => setRoute({ name: "detail", id })}
          onLogout={logout}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
});
