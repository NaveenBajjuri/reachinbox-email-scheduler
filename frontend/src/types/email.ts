export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  googleId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Email {
  id: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
  sender: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  attempts: number;
  previewUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  recipients: string[];
  sender: string;
  startTime: string; // ISO string
  delayBetweenEmails: number; // in milliseconds
  hourlyLimit?: number;
}

export interface ScheduleEmailResponse {
  success: boolean;
  scheduledCount: number;
  message: string;
  emailIds: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadParseResult {
  validEmails: string[];
  invalidCount: number;
  totalParsed: number;
}
