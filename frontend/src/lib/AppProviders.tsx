// Bundles every client-only provider (MUI theme, date-picker localization,
// auth context) into one "use client" boundary. Kept separate from
// ThemeRegistry (which specifically handles emotion SSR style injection) so
// each file has one job. This also fixes a Next.js App Router pitfall: since
// AdapterDayjs is a function/class, passing it as a prop straight from the
// (Server Component) root layout into LocalizationProvider fails during
// prerendering — wrapping it here, inside a "use client" module, keeps that
// prop entirely on the client side.

"use client";

import { ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "./theme";
import { AuthProvider } from "./auth-context";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <AuthProvider>{children}</AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
