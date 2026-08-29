"use client";

import { useState } from "react";
import {
  Box,
  Avatar,
  Typography,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import ScheduleIcon from "@mui/icons-material/AccessTime";
import SendIcon from "@mui/icons-material/NearMe";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "@/lib/auth-context";
import Logo from "./Logo";
import SlackConnectButton from "./SlackConnectButton";

export type DashboardTab = "scheduled" | "sent";

interface SidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onCompose: () => void;
  scheduledCount: number;
  sentCount: number;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  onCompose,
  scheduledCount,
  sentCount,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <Box
      sx={{
        width: 260,
        flexShrink: 0,
        borderRight: "1px solid",
        borderColor: "divider",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        p: 2,
      }}
    >
      <Box sx={{ px: 0.5, mb: 2 }}>
        <Logo />
      </Box>

      {/* User info + dropdown */}
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.2,
          p: 1,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          cursor: "pointer",
          mb: 2,
          "&:hover": { bgcolor: "#F9FAFB" },
        }}
      >
        <Avatar src={user?.avatarUrl ?? undefined} sx={{ width: 34, height: 34 }}>
          {user?.name?.[0]}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {user?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {user?.email}
          </Typography>
        </Box>
        <ExpandMoreIcon fontSize="small" sx={{ color: "text.secondary" }} />
      </Box>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            logout();
          }}
        >
          <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>

      <Button
        fullWidth
        variant="outlined"
        onClick={onCompose}
        sx={{
          borderColor: "primary.main",
          color: "primary.main",
          fontWeight: 600,
          py: 1,
          mb: 2.5,
          "&:hover": { bgcolor: "primary.light", borderColor: "primary.main" },
        }}
      >
        Compose
      </Button>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 1, mb: 0.5, fontWeight: 600, letterSpacing: "0.05em" }}
      >
        CORE
      </Typography>

      <List sx={{ mb: 2 }}>
        <ListItemButton
          selected={activeTab === "scheduled"}
          onClick={() => onTabChange("scheduled")}
          sx={{
            borderRadius: 2,
            mb: 0.5,
            "&.Mui-selected": { bgcolor: "primary.light" },
            "&.Mui-selected:hover": { bgcolor: "primary.light" },
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <ScheduleIcon fontSize="small" color={activeTab === "scheduled" ? "primary" : "inherit"} />
          </ListItemIcon>
          <ListItemText
            primary="Scheduled"
            slotProps={{ primary: { sx: { fontWeight: activeTab === "scheduled" ? 700 : 500 } } }}
          />
          <Chip label={scheduledCount} size="small" sx={{ bgcolor: "transparent", fontWeight: 600 }} />
        </ListItemButton>

        <ListItemButton
          selected={activeTab === "sent"}
          onClick={() => onTabChange("sent")}
          sx={{
            borderRadius: 2,
            "&.Mui-selected": { bgcolor: "primary.light" },
            "&.Mui-selected:hover": { bgcolor: "primary.light" },
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <SendIcon fontSize="small" color={activeTab === "sent" ? "primary" : "inherit"} />
          </ListItemIcon>
          <ListItemText
            primary="Sent"
            slotProps={{ primary: { sx: { fontWeight: activeTab === "sent" ? 700 : 500 } } }}
          />
          <Chip label={sentCount} size="small" sx={{ bgcolor: "transparent", fontWeight: 600 }} />
        </ListItemButton>
      </List>

      <Box sx={{ mt: "auto" }}>
        <Divider sx={{ mb: 1.5 }} />
        <SlackConnectButton />
      </Box>
    </Box>
  );
}
