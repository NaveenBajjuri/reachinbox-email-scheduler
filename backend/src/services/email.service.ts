import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporterInstance: Transporter | null = null;

export async function getTransporter(): Promise<Transporter> {
  if (transporterInstance) {
    return transporterInstance;
  }

  let user = env.SMTP_USER;
  let pass = env.SMTP_PASS;

  // If no SMTP credentials provided, dynamically provision an Ethereal test account
  if (!user || !pass) {
    logger.info('No SMTP credentials in env. Provisioning dynamic Ethereal test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
      logger.info('Ethereal test account provisioned:', {
        user,
        pass,
        webUrl: 'https://ethereal.email/messages',
      });
    } catch (err: any) {
      logger.error('Failed to provision Ethereal test account:', { error: err.message });
      throw new Error(`Failed to initialize Ethereal SMTP account: ${err.message}`);
    }
  }

  transporterInstance = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    await transporterInstance.verify();
    logger.info('SMTP connection verified successfully with Ethereal server');
  } catch (error: any) {
    logger.warn('SMTP verification warning:', { error: error.message });
  }

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
  const transporter = await getTransporter();
  const from = options.sender || env.SMTP_FROM;

  const mailOptions = {
    from,
    to: options.to,
    subject: options.subject,
    html: options.body,
    text: options.body.replace(/<[^>]*>?/gm, ''), // plain text fallback
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    logger.info(`Email sent successfully to "${options.to}"`, {
      messageId: info.messageId,
      previewUrl: previewUrl || 'N/A',
    });

    return {
      messageId: info.messageId,
      previewUrl,
    };
  } catch (error: any) {
    logger.error(`Failed to send email to "${options.to}":`, { error: error.message });
    throw error;
  }
}
