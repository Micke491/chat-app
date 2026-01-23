import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });
  }

  async sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Chat App" <nikolamicic07@gmail.com>', 
        to,
        subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Message sent: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Email Error:', error);
      return false;
    }
  }

  generatePasswordResetEmail(resetURL: string, username: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          /* (Keep your CSS exactly as you had it) */
          body { font-family: sans-serif; background-color: #f4f4f4; padding: 20px; }
          .container { background: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: auto; }
          .button { background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Password Reset Request</h2>
          <p>Hi ${username},</p>
          <p>Click below to reset your password:</p>
          <a href="${resetURL}" class="button">Reset Password</a>
          <p>Or copy this link: ${resetURL}</p>
        </div>
      </body>
      </html>
    `;
  }

  // ... (Keep your existing generatePasswordResetSuccessEmail function here) ...
  generatePasswordResetSuccessEmail(username: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <body>
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Password Changed Successfully</h2>
          <p>Hi ${username},</p>
          <p>Your password has been updated. If this wasn't you, contact support immediately.</p>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();