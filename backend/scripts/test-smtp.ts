import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('1. Calling nodemailer.createTestAccount()...');
  try {
    const account = await nodemailer.createTestAccount();
    console.log('Account created:', account.user, account.pass);

    const transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    console.log('2. Verifying connection...');
    await transporter.verify();
    console.log('Connection verified!');

    console.log('3. Sending test email...');
    const info = await transporter.sendMail({
      from: 'test@reachinbox.ai',
      to: 'recipient@example.com',
      subject: 'Test ReachInbox Ethereal',
      text: 'Hello world',
    });
    console.log('Message sent! ID:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));

    // Update .env
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');
    envContent = envContent.replace(/SMTP_USER=.*/, `SMTP_USER=${account.user}`);
    envContent = envContent.replace(/SMTP_PASS=.*/, `SMTP_PASS=${account.pass}`);
    fs.writeFileSync(envPath, envContent);
    console.log('Updated .env with verified credentials.');
  } catch (err: any) {
    console.error('Error during SMTP test:', err.message);
  }
}

main();
