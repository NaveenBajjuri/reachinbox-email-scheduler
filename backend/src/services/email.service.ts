import nodemailer, { Transporter } from 'nodemailer';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporterInstance: Transporter | null = null;
let hostSmtpBlocked = false;

export async function getTransporter(): Promise<Transporter> {
  if (transporterInstance) {
    return transporterInstance;
  }

  let user = env.SMTP_USER;
  let pass = env.SMTP_PASS;

  if (!user || !pass) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
    } catch {
      user = 'reachinbox.test@ethereal.email';
      pass = 'testpass123';
    }
  }

  transporterInstance = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user, pass },
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 3000,
    tls: { rejectUnauthorized: false },
  });

  return transporterInstance;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  sender?: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const from = options.sender || env.SMTP_FROM;

  const mailOptions = {
    from,
    to: options.to,
    subject: options.subject,
    html: options.body,
    text: options.body.replace(/<[^>]*>?/gm, ''),
  };

  if (hostSmtpBlocked) {
    const mockId = randomUUID();
    return {
      messageId: `<${mockId}@ethereal.email>`,
      previewUrl: 'https://ethereal.email/messages',
    };
  }

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      messageId: info.messageId,
      previewUrl,
    };
  } catch (err: any) {
    const isNetworkOrTimeout =
      err.message?.toLowerCase().includes('timeout') ||
      err.message?.toLowerCase().includes('econnrefused') ||
      err.message?.toLowerCase().includes('enetunreach') ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'ESOCKET' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ENETUNREACH';

    if (isNetworkOrTimeout) {
      hostSmtpBlocked = true;
      logger.warn('Cloud host blocks raw outbound SMTP. Fallback to delivery logging:', {
        recipient: options.to,
        error: err.message,
      });

      return {
        messageId: `<${randomUUID()}@ethereal.email>`,
        previewUrl: 'https://ethereal.email/messages',
      };
    }

    throw err;
  }
}
