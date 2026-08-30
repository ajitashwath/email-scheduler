"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import Sidebar, { DashboardTab } from "@/components/dashboard/Sidebar";
import EmailListPanel, { EmailListRow } from "@/components/dashboard/EmailListPanel";
import ComposePage from "@/components/compose/ComposePage";
import { PaginatedResponse, ScheduledEmail, SentEmail } from "@/types";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<DashboardTab>("scheduled");
  const [composing, setComposing] = useState(false);

  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  const fetchScheduled = useCallback(async (query = "") => {
    const endpoint = query.trim()
      ? `/emails/search?q=${encodeURIComponent(query)}&status=SCHEDULED,QUEUED,SENDING,RATE_LIMITED_DEFERRED`
      : "/emails/scheduled";
    const { data } = await api.get<PaginatedResponse<ScheduledEmail>>(endpoint);
    setScheduled(data.emails);
    setScheduledTotal(data.total);
  }, []);

  const fetchSent = useCallback(async (query = "") => {
    const endpoint = query.trim()
      ? `/emails/search?q=${encodeURIComponent(query)}&status=SENT,FAILED`
      : "/emails/sent";
    const { data } = await api.get<PaginatedResponse<SentEmail>>(endpoint);
    setSent(data.emails);
    setSentTotal(data.total);
  }, []);

  const refreshAll = useCallback(async (query = "") => {
    setListLoading(true);
    try {
      await Promise.all([fetchScheduled(query), fetchSent(query)]);
    } finally {
      setListLoading(false);
    }
  }, [fetchScheduled, fetchSent]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data refresh once the user is known
    if (!user) return;
    const timeout = window.setTimeout(() => void refreshAll(search), 250);
    return () => window.clearTimeout(timeout);
  }, [user, refreshAll, search]);

  if (authLoading || !user) {
    return (
      <Box sx={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (composing) {
    return (
      <Box sx={{ display: "flex", height: "100vh" }}>
        <ComposePage
          onClose={() => setComposing(false)}
          onScheduled={() => {
            setComposing(false);
            refreshAll();
          }}
        />
      </Box>
    );
  }

  const scheduledRows: EmailListRow[] = scheduled.map((e) => ({
      id: e.id,
      recipientEmail: e.recipientEmail,
      subject: e.subject,
      timestamp: e.scheduledFor,
      status: e.status,
    }));

  const sentRows: EmailListRow[] = sent.map((e) => ({
      id: e.id,
      recipientEmail: e.recipientEmail,
      subject: e.subject,
      timestamp: e.sentAt,
      status: e.status,
      preview: e.lastError ?? undefined,
      previewUrl: e.previewUrl,
    }));

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCompose={() => setComposing(true)}
        scheduledCount={scheduledTotal}
        sentCount={sentTotal}
      />

      {activeTab === "scheduled" ? (
        <EmailListPanel
          title="Scheduled Emails"
          rows={scheduledRows}
          loading={listLoading}
          onRefresh={refreshAll}
          searchValue={search}
          onSearchChange={setSearch}
          emptyLabel="No scheduled emails"
          emptyHint="Compose a new email to schedule your first send."
        />
      ) : (
        <EmailListPanel
          title="Sent Emails"
          rows={sentRows}
          loading={listLoading}
          onRefresh={refreshAll}
          searchValue={search}
          onSearchChange={setSearch}
          emptyLabel="No sent emails yet"
          emptyHint="Emails will show up here once they've gone out."
        />
      )}
    </Box>
  );
}
