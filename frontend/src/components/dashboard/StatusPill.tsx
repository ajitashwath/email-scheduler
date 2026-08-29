"use client";

import { Chip } from "@mui/material";
import { EmailStatus } from "@/types";

const STATUS_CONFIG: Record<EmailStatus, { label: string; bg: string; color: string }> = {
  SCHEDULED: { label: "Scheduled", bg: "#FEF3E2", color: "#B45309" },
  QUEUED: { label: "Queued", bg: "#FEF3E2", color: "#B45309" },
  SENDING: { label: "Sending", bg: "#E7F0FE", color: "#1D4ED8" },
  SENT: { label: "Sent", bg: "#F3F4F6", color: "#374151" },
  FAILED: { label: "Failed", bg: "#FDE8E8", color: "#B91C1C" },
  RATE_LIMITED_DEFERRED: { label: "Deferred", bg: "#F3E8FF", color: "#7E22CE" },
};

export default function StatusPill({ status }: { status: EmailStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        bgcolor: config.bg,
        color: config.color,
        fontWeight: 600,
        fontSize: 12,
        height: 24,
      }}
    />
  );
}
