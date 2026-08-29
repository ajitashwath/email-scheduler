// MUI theme tuned to match the Figma: soft green accent (#0F9D58-ish), very
// light neutral grays for inputs/hover states, pill-shaped buttons and chips,
// and a blocky monospace wordmark font for the "ONB" logo specifically
// (applied locally via the Logo component, not globally).

"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1DA462", // Figma's compose/login button green
      light: "#E7F6EE", // Login-with-Google pill background
      dark: "#158A50",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#111827",
    },
    background: {
      default: "#FFFFFF",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#111827",
      secondary: "#6B7280",
    },
    divider: "#E5E7EB",
    warning: {
      main: "#D97706",
      light: "#FEF3E2",
    },
    error: {
      main: "#DC2626",
      light: "#FDE8E8",
    },
    success: {
      main: "#1DA462",
      light: "#E7F6EE",
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      "Helvetica",
      "Arial",
      "sans-serif",
    ].join(","),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingLeft: 20,
          paddingRight: 20,
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: "#F9FAFB",
        },
        notchedOutline: {
          borderColor: "#E5E7EB",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});
