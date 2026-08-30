// Shared types mirroring the backend's API response shapes. Kept hand-written
// (rather than generated) since the backend is a separate package in this
// monorepo — see backend/src/controllers for the source of truth.

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export type EmailStatus =
  | "SCHEDULED"
  | "QUEUED"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "RATE_LIMITED_DEFERRED";

export interface ScheduledEmail {
  id: string;
  recipientEmail: string;
  subject: string;
  scheduledFor: string;
  status: EmailStatus;
}

export interface SentEmail {
  id: string;
  recipientEmail: string;
  subject: string;
  sentAt: string | null;
  status: EmailStatus;
  lastError: string | null;
  previewUrl: string | null;
}

export interface EmailDetails {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledFor: string;
  sentAt: string | null;
  status: EmailStatus;
  lastError: string | null;
  sender: { fromAddress: string };
  previewUrl: string | null;
}

export interface Sender {
  id: string;
  label: string;
  fromAddress: string;
  maxEmailsPerHour: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName: string | null;
  channel: string | null;
}

export interface ParsedLeads {
  count: number;
  emails: string[];
}

export interface PaginatedResponse<T> {
  emails: T[];
  total: number;
  page: number;
  pageSize: number;
}
