"use client";

import { useRef, useState } from "react";
import {
  Box,
  IconButton,
  Typography,
  Button,
  TextField,
  Autocomplete,
  Chip,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs, { Dayjs } from "dayjs";
import { api } from "@/lib/api";

interface ComposePageProps {
  onClose: () => void;
  onScheduled: () => void;
}

const SEND_LATER_PRESETS = [
  { label: "Tomorrow, 9:00 AM", getValue: () => dayjs().add(1, "day").hour(9).minute(0) },
  { label: "Tomorrow, 10:00 AM", getValue: () => dayjs().add(1, "day").hour(10).minute(0) },
  { label: "Tomorrow, 11:00 AM", getValue: () => dayjs().add(1, "day").hour(11).minute(0) },
  { label: "Tomorrow, 3:00 PM", getValue: () => dayjs().add(1, "day").hour(15).minute(0) },
];

export default function ComposePage({ onClose, onScheduled }: ComposePageProps) {
  const [to, setTo] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("");
  const [hourlyLimit, setHourlyLimit] = useState("");
  const [sendAt, setSendAt] = useState<Dayjs>(dayjs().add(5, "minute"));
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);

  const [sendLaterAnchor, setSendLaterAnchor] = useState<HTMLElement | null>(null);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const leadsInputRef = useRef<HTMLInputElement>(null);

  const handleLeadsUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post<{ count: number; emails: string[] }>(
      "/leads/parse",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    setTo((prev) => Array.from(new Set([...prev, ...data.emails])));
    setUploadCount(data.count);
  };

  const handleAttachment = (file: File) => {
    setAttachmentNames((prev) => [...prev, file.name]);
  };

  const handleSubmit = async () => {
    setError(null);

    if (to.length === 0) {
      setError("Add at least one recipient.");
      return;
    }
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!body.trim()) {
      setError("Email body is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/campaigns", {
        subject,
        body,
        startTime: sendAt.toISOString(),
        delayBetweenMs: delaySeconds ? Number(delaySeconds) * 1000 : undefined,
        hourlyLimit: hourlyLimit ? Number(hourlyLimit) : undefined,
        recipients: to,
      });
      onScheduled();
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to schedule email. Please try again.";
      setError(typeof message === "string" ? message : "Failed to schedule email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton onClick={onClose} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Compose New Email
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            icon={<AttachFileIcon sx={{ fontSize: 16 }} />}
            label={attachmentNames.length || undefined}
            onClick={() => fileInputRef.current?.click()}
            variant="outlined"
            size="small"
            sx={{ color: "primary.main", borderColor: "primary.main", cursor: "pointer" }}
          />
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => e.target.files?.[0] && handleAttachment(e.target.files[0])}
          />

          <IconButton
            size="small"
            onClick={(e) => setSendLaterAnchor(e.currentTarget)}
            sx={{ color: "primary.main" }}
          >
            <AccessTimeIcon fontSize="small" />
          </IconButton>

          <Button
            variant="outlined"
            size="small"
            onClick={(e) => setSendLaterAnchor(e.currentTarget)}
            sx={{ borderColor: "primary.main", color: "primary.main", fontWeight: 600 }}
          >
            {sendAt.isAfter(dayjs().add(1, "minute")) ? "Send Later" : "Send"}
          </Button>

          <Button
            variant="contained"
            size="small"
            onClick={handleSubmit}
            disabled={submitting}
            sx={{ fontWeight: 600, minWidth: 90 }}
          >
            {submitting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Send"}
          </Button>
        </Box>

        <Popover
          open={!!sendLaterAnchor}
          anchorEl={sendLaterAnchor}
          onClose={() => setSendLaterAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Box sx={{ width: 280, p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Send Later
            </Typography>

            <TextField
              fullWidth
              size="small"
              placeholder="Pick date & time"
              value={sendAt.format("MMM D, YYYY h:mm A")}
              onClick={() => setCustomPickerOpen(true)}
              sx={{ mb: 1.5 }}
              slotProps={{ input: { readOnly: true } }}
            />

            {customPickerOpen && (
              <Box sx={{ mb: 1.5 }}>
                <DateTimePicker
                  value={sendAt}
                  onChange={(val) => val && setSendAt(val)}
                  disablePast
                  sx={{ width: "100%" }}
                />
              </Box>
            )}

            <List disablePadding>
              {SEND_LATER_PRESETS.map((preset) => (
                <ListItemButton
                  key={preset.label}
                  dense
                  onClick={() => setSendAt(preset.getValue())}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemText primary={preset.label} />
                </ListItemButton>
              ))}
            </List>

            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button size="small" onClick={() => setSendLaterAnchor(null)}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setSendLaterAnchor(null)}
                sx={{ borderColor: "primary.main", color: "primary.main" }}
              >
                Done
              </Button>
            </Box>
          </Box>
        </Popover>
      </Box>

      {/* Form */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {uploadCount !== null && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setUploadCount(null)}>
            Detected {uploadCount} email address{uploadCount === 1 ? "" : "es"} in the uploaded file.
          </Alert>
        )}

        <FieldRow label="From">
          <TextField
            fullWidth
            value="Default Ethereal Sender"
            disabled
            slotProps={{ input: { readOnly: true } }}
          />
        </FieldRow>

        <FieldRow label="To">
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <Autocomplete
              multiple
              freeSolo
              fullWidth
              options={[]}
              value={to}
              inputValue={toInput}
              onInputChange={(_, val) => setToInput(val)}
              onChange={(_, val) => setTo(val as string[])}
              renderValue={(value, getItemProps) => {
                const shown = value.slice(0, 3);
                const overflow = value.length - shown.length;
                return (
                  <>
                    {shown.map((option, index) => {
                      const { key, ...rest } = getItemProps({ index });
                      return (
                        <Chip
                          key={key}
                          {...rest}
                          label={option}
                          size="small"
                          sx={{ bgcolor: "primary.light", color: "primary.dark", fontWeight: 500 }}
                        />
                      );
                    })}
                    {overflow > 0 && (
                      <Chip
                        label={`+${overflow}`}
                        size="small"
                        sx={{ bgcolor: "primary.light", color: "primary.dark", fontWeight: 600 }}
                      />
                    )}
                  </>
                );
              }}
              renderInput={(params) => (
                <TextField {...params} placeholder="recipient@example.com" />
              )}
              sx={{ flex: 1 }}
            />
            <Button
              startIcon={<FileUploadIcon fontSize="small" />}
              onClick={() => leadsInputRef.current?.click()}
              sx={{ color: "primary.main", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Upload List
            </Button>
            <input
              ref={leadsInputRef}
              type="file"
              hidden
              accept=".csv,.txt"
              onChange={(e) => e.target.files?.[0] && handleLeadsUpload(e.target.files[0])}
            />
          </Box>
        </FieldRow>

        <FieldRow label="Subject">
          <TextField
            fullWidth
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </FieldRow>

        <Box sx={{ display: "flex", gap: 3, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="body2" sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
              Delay between 2 emails
            </Typography>
            <TextField
              placeholder="00"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value.replace(/\D/g, ""))}
              sx={{ width: 70 }}
              slotProps={{
                input: {
                  endAdornment: (
                    <Typography variant="caption" color="text.secondary">
                      s
                    </Typography>
                  ),
                },
              }}
            />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="body2" sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
              Hourly Limit
            </Typography>
            <TextField
              placeholder="00"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value.replace(/\D/g, ""))}
              sx={{ width: 70 }}
            />
          </Box>
        </Box>

        {/* Body + rich text toolbar */}
        <Box
          sx={{
            mt: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <TextField
            fullWidth
            multiline
            minRows={10}
            placeholder="Type Your Reply..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            variant="standard"
            slotProps={{ input: { disableUnderline: true } }}
            sx={{ px: 2, pt: 2, "& .MuiInputBase-root": { bgcolor: "#F9FAFB" } }}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.5,
              py: 1,
              borderTop: "1px solid",
              borderColor: "divider",
              bgcolor: "#F9FAFB",
              flexWrap: "wrap",
            }}
          >
            {[UndoIcon, RedoIcon].map((Icon, i) => (
              <IconButton key={i} size="small">
                <Icon fontSize="small" />
              </IconButton>
            ))}
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            {[FormatBoldIcon, FormatItalicIcon, FormatUnderlinedIcon].map((Icon, i) => (
              <IconButton key={i} size="small">
                <Icon fontSize="small" />
              </IconButton>
            ))}
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            {[FormatListNumberedIcon, FormatListBulletedIcon, FormatQuoteIcon, StrikethroughSIcon].map(
              (Icon, i) => (
                <IconButton key={i} size="small">
                  <Icon fontSize="small" />
                </IconButton>
              )
            )}
          </Box>
        </Box>

        {attachmentNames.length > 0 && (
          <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
            {attachmentNames.map((name) => (
              <Chip key={name} label={name} variant="outlined" />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" sx={{ width: 70, flexShrink: 0, fontWeight: 600 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}
