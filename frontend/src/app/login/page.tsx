"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Divider,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useAuth } from "@/lib/auth-context";

// Google's official "G" mark, inline so we don't depend on an external
// asset. Kept as its real four-color logo per Google branding guidelines.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.61z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={28} />
        </Box>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { loginWithGoogleUrl } = useAuth();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  // Local email/password fields are shown per the Figma design. Google OAuth
  // is the only real, working auth method this backend implements (per the
  // assignment's "Google Login (Required), no mock" requirement) — the
  // email/password form is present for visual parity with the design but
  // submitting it explains that Google is the supported path, rather than
  // silently pretending to authenticate.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState(false);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#FFFFFF",
        p: 2,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: 420,
          borderRadius: 4,
          p: 4,
          borderColor: "#E5E7EB",
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, textAlign: "center", mb: 3 }}>
          Login
        </Typography>

        {oauthError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            Google sign-in didn&apos;t go through. Please try again.
          </Alert>
        )}

        <Button
          fullWidth
          size="large"
          startIcon={<GoogleIcon />}
          href={loginWithGoogleUrl}
          sx={{
            bgcolor: "primary.light",
            color: "text.primary",
            fontWeight: 500,
            py: 1.3,
            "&:hover": { bgcolor: "#DCF3E7" },
          }}
        >
          Login with Google
        </Button>

        <Box sx={{ display: "flex", alignItems: "center", my: 3, gap: 1.5 }}>
          <Divider sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">
            or sign up through email
          </Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>

        {notice && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            Email/password login isn&apos;t wired up — this project uses real
            Google OAuth as its authentication method. Use &quot;Login with
            Google&quot; above.
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(true);
          }}
        >
          <TextField
            fullWidth
            placeholder="Email ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 3 }}
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            sx={{ py: 1.3, fontWeight: 600 }}
          >
            Login
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
