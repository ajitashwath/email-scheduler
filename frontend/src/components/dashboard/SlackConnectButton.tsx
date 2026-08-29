"use client";

import { useEffect, useState } from "react";
import { Box, Button, Chip, CircularProgress, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { api, API_BASE_URL } from "@/lib/api";
import { SlackStatus } from "@/types";

/**
 * Shows the live Slack connection state and drives the real OAuth flow.
 * "Connect Slack" navigates the browser to the backend's
 * /api/slack/authorize, which redirects into Slack's real consent screen;
 * Slack then redirects back to /api/slack/callback, and the backend
 * redirects the browser back here with ?slack=connected, at which point we
 * refetch status.
 */
export default function SlackConnectButton() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const { data } = await api.get<SlackStatus>("/slack/status");
      setStatus(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Re-check status if we just bounced back from the OAuth redirect.
    const params = new URLSearchParams(window.location.search);
    if (params.get("slack")) {
      fetchStatus();
    }
  }, []);

  const disconnect = async () => {
    await api.post("/slack/disconnect");
    fetchStatus();
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  if (status?.connected) {
    return (
      <Box sx={{ px: 0.5 }}>
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
          label={`Slack: ${status.teamName}`}
          size="small"
          color="success"
          variant="outlined"
          sx={{ width: "100%", justifyContent: "flex-start", mb: 0.5 }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          onClick={disconnect}
          sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" }, pl: 0.5 }}
        >
          Disconnect
        </Typography>
      </Box>
    );
  }

  return (
    <Button
      fullWidth
      variant="outlined"
      size="small"
      href={`${API_BASE_URL}/api/slack/authorize`}
      sx={{
        borderColor: "divider",
        color: "text.secondary",
        justifyContent: "flex-start",
        fontWeight: 500,
      }}
    >
      Connect Slack
    </Button>
  );
}
