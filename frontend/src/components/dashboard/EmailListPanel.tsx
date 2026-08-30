"use client";

import { useState } from "react";

import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  List,
  ListItemButton,
  Typography,
  Skeleton,
  Tooltip,
  Dialog,
  DialogContent,
  Button,
  CircularProgress,
  Avatar,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import InboxIcon from "@mui/icons-material/Inbox";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import dayjs from "dayjs";
import StatusPill from "./StatusPill";
import { EmailDetails, EmailStatus } from "@/types";
import { api } from "@/lib/api";

export interface EmailListRow {
  id: string;
  recipientEmail: string;
  subject: string;
  timestamp: string | null; // scheduledFor or sentAt
  status: EmailStatus;
  preview?: string;
  previewUrl?: string | null;
}

interface EmailListPanelProps {
  title: string;
  rows: EmailListRow[];
  loading: boolean;
  onRefresh: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  emptyLabel: string;
  emptyHint: string;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  const date = dayjs(ts);
  const now = dayjs();
  if (date.isSame(now, "day")) return date.format("h:mm A");
  if (date.isSame(now, "year")) return date.format("MMM D, h:mm A");
  return date.format("MMM D YYYY, h:mm A");
}

export default function EmailListPanel({
  rows,
  loading,
  onRefresh,
  searchValue,
  onSearchChange,
  emptyLabel,
  emptyHint,
}: EmailListPanelProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailDetails | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openEmail = async (id: string) => {
    setOpeningId(id);
    try {
      const { data } = await api.get<{ email: EmailDetails }>(`/emails/${id}`);
      setSelectedEmail(data.email);
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* Search bar header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 2.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <TextField
          fullWidth
          placeholder="Search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            "& .MuiOutlinedInput-root": { bgcolor: "#F9FAFB", borderRadius: 999 },
          }}
        />
        <Tooltip title="Filter">
          <IconButton size="small" sx={{ color: "text.secondary" }}>
            <FilterListIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => onRefresh()} sx={{ color: "text.secondary" }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Rows */}
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <Box sx={{ p: 2 }}>
            {[...Array(5)].map((_, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.8, px: 1 }}>
                <Skeleton variant="text" width={140} />
                <Skeleton variant="rounded" width={90} height={22} />
                <Skeleton variant="text" width="50%" />
              </Box>
            ))}
          </Box>
        )}

        {!loading && rows.length === 0 && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: 320,
              color: "text.secondary",
              gap: 1,
            }}
          >
            <InboxIcon sx={{ fontSize: 40, color: "#D1D5DB" }} />
            <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600 }}>
              {emptyLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {emptyHint}
            </Typography>
          </Box>
        )}

        {!loading && rows.length > 0 && (
          <List disablePadding>
            {rows.map((row) => (
              <ListItemButton
                key={row.id}
                onClick={() => void openEmail(row.id)}
                sx={{
                  px: 2.5,
                  py: 1.7,
                  borderBottom: "1px solid",
                  borderColor: "#F3F4F6",
                  gap: 2,
                }}
              >
                {openingId === row.id && <CircularProgress size={16} sx={{ flexShrink: 0 }} />}
                <Typography
                  variant="body2"
                  sx={{ width: 180, flexShrink: 0, fontWeight: 600 }}
                  noWrap
                >
                  To: {row.recipientEmail}
                </Typography>

                <Box sx={{ width: 130, flexShrink: 0 }}>
                  <StatusPill status={row.status} />
                </Box>

                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap color="text.secondary">
                  <Typography component="span" variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
                    {row.subject}
                  </Typography>
                  {row.preview ? ` - ${row.preview}` : ""}
                </Typography>

                <Typography variant="caption" color="text.secondary" sx={{ width: 110, flexShrink: 0, textAlign: "right" }}>
                  {formatTimestamp(row.timestamp)}
                </Typography>

                <IconButton size="small" sx={{ color: "text.secondary" }}>
                  <StarBorderIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>

      <Dialog
        open={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
        fullScreen
        slotProps={{ paper: { sx: { bgcolor: "#fff" } } }}
      >
        {selectedEmail && (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: 64,
                px: { xs: 2, md: 4 },
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                <IconButton onClick={() => setSelectedEmail(null)} aria-label="Back to emails">
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" noWrap sx={{ fontWeight: 500 }}>
                  {selectedEmail.subject}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", color: "text.secondary" }}>
                <IconButton aria-label="Star email"><StarBorderIcon /></IconButton>
                <IconButton aria-label="Archive email"><ArchiveOutlinedIcon /></IconButton>
                <IconButton aria-label="Delete email"><DeleteIcon /></IconButton>
                <IconButton aria-label="More actions"><MoreVertIcon /></IconButton>
              </Box>
            </Box>

            <DialogContent sx={{ px: { xs: 3, md: 8 }, py: 3 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 3 }}>
                <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32 }}>
                  {selectedEmail.sender.fromAddress[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {selectedEmail.sender.fromAddress}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    to {selectedEmail.recipientEmail}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {dayjs(selectedEmail.sentAt ?? selectedEmail.scheduledFor).format("MMM D, h:mm A")}
                </Typography>
              </Box>
              <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: 760, ml: 6 }}>
                {selectedEmail.body}
              </Typography>
              {selectedEmail.previewUrl && (
                <Button
                  component="a"
                  href={selectedEmail.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ mt: 2, px: 0 }}
                >
                  Open Ethereal preview
                </Button>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
