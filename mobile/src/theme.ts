// Shared theme: restrained palette, one accent, generous spacing.
export const theme = {
  colors: {
    bg: "#F6F7F9",
    card: "#FFFFFF",
    text: "#1A1D21",
    muted: "#6B7280",
    border: "#E5E7EB",
    accent: "#1D4ED8",
    accentSoft: "#EFF4FF",
    success: "#15803D",
    successSoft: "#ECFDF3",
    danger: "#B91C1C",
    dangerSoft: "#FEF2F2",
    warn: "#B45309",
    warnSoft: "#FFFBEB",
  },
  radius: 14,
  pad: 16,
  fontSize: { title: 26, subtitle: 15, body: 15, small: 13, money: 22 },
};

export const inr = (amount: string | number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(Number(amount));

export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const todayISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
