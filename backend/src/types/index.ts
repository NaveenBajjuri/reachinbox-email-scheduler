import { EmailStatus } from '@prisma/client';

export interface EmailJobData {
  emailId: string;
}

export interface UserDTO {
  id: string;
  googleId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface EmailDTO {
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

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  sender: string;
  startTime: string; // ISO date string
  delayBetweenEmails: number; // in milliseconds
  hourlyLimit?: number; // max per hour per sender
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
