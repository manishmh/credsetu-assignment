import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { saveToken } from "../auth/session";
import { theme } from "../theme";
import { Button, Card, Field, TextBox } from "../components/ui";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.sendOtp(phone.trim());
      setStep("otp");
      setInfo("OTP sent. In this dev build, read the 6-digit code from the backend terminal logs.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.verifyOtp(phone.trim(), code.trim());
      await saveToken(res.token);
      onLoggedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
      <View style={styles.brand}>
        <Text style={styles.logo}>MiniLedger</Text>
        <Text style={styles.tag}>Track money lent to friends.</Text>
      </View>
      <Card>
        {step === "phone" ? (
          <Field label="Phone number (include country code, e.g. +91…)">
            <TextBox value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+919876543210" autoCapitalize="none" />
          </Field>
        ) : (
          <>
            <Text style={styles.sentTo}>Code sent to {phone} — <Text style={styles.link} onPress={() => setStep("phone")}>change</Text></Text>
            <Field label="6-digit OTP">
              <TextBox value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="123456" maxLength={6} />
            </Field>
          </>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!info && <Text style={styles.info}>{info}</Text>}
        {step === "phone" ? (
          <Button title="Send OTP" onPress={send} loading={busy} disabled={phone.trim().length < 7} />
        ) : (
          <>
            <Button title="Verify & log in" onPress={verify} loading={busy} disabled={code.trim().length !== 6} />
            <View style={{ height: 8 }} />
            <Button title="Resend code" secondary onPress={send} disabled={busy} />
          </>
        )}
        <Text style={styles.note}>Dev-only mock auth: the OTP is printed in the backend server terminal, not sent by SMS.</Text>
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg, padding: 20, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: 24 },
  logo: { fontSize: 34, fontWeight: "800", color: theme.colors.accent },
  tag: { color: theme.colors.muted, marginTop: 4, fontSize: theme.fontSize.subtitle },
  sentTo: { marginBottom: 12, color: theme.colors.text },
  link: { color: theme.colors.accent, fontWeight: "700" },
  error: { color: theme.colors.danger, marginBottom: 8 },
  info: { color: theme.colors.success, marginBottom: 8 },
  note: { color: theme.colors.muted, fontSize: 12, marginTop: 12, textAlign: "center" },
});
