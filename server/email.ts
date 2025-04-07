import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable not set. Email functionality will be limited.");
}

// Initialize SendGrid mail service with API key
const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY || '');

// Email templates
const EMAIL_TEMPLATES = {
  PASSWORD_RESET: {
    subject: 'Reset Your Daynotes Password',
    text: (resetLink: string) => 
      `You requested a password reset for your Daynotes account. Please click the following link to reset your password: ${resetLink}\n\n` +
      `If you didn't request this, you can safely ignore this email.\n\n` +
      `The Daynotes Team`,
    html: (resetLink: string) => 
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(to right, #3b4e87, #6c88c4); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Daynotes</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #eaeaea; border-top: none;">
          <h2>Reset Your Password</h2>
          <p>You requested a password reset for your Daynotes account. Please click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #3b4e87; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>Best regards,<br>The Daynotes Team</p>
        </div>
        <div style="background-color: #f7f7f7; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          &copy; ${new Date().getFullYear()} Daynotes. All rights reserved.
        </div>
      </div>`
  },
  WELCOME: {
    subject: 'Welcome to Daynotes!',
    text: (name: string) => 
      `Hi ${name},\n\nWelcome to Daynotes! We're excited to have you on board.\n\n` +
      `Daynotes helps you capture daily notes and provides AI-powered insights about your entries.\n\n` +
      `To get started, simply log in and begin adding notes for today. Our AI will analyze your entries and provide insights as you use the app.\n\n` +
      `If you have any questions, feel free to reply to this email.\n\n` +
      `Happy note-taking!\nThe Daynotes Team`,
    html: (name: string) => 
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(to right, #3b4e87, #6c88c4); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Daynotes</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #eaeaea; border-top: none;">
          <h2>Welcome to Daynotes!</h2>
          <p>Hi ${name},</p>
          <p>We're excited to have you on board. Daynotes helps you capture daily thoughts and provides AI-powered insights about your entries.</p>
          <h3>Getting Started</h3>
          <ol>
            <li>Log in to your account</li>
            <li>Start adding notes for today</li>
            <li>View AI-generated insights about your entries</li>
            <li>Mark important entries as "Moments" for special analysis</li>
          </ol>
          <p>Our streak tracking feature will help you build a consistent note-taking habit!</p>
          <p>If you have any questions, feel free to reply to this email.</p>
          <p>Happy note-taking!<br>The Daynotes Team</p>
        </div>
        <div style="background-color: #f7f7f7; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          &copy; ${new Date().getFullYear()} Daynotes. All rights reserved.
        </div>
      </div>`
  },
  MARKETING: {
    subject: 'New Features in Daynotes!',
    text: (features: string[]) => 
      `Hello Daynotes User,\n\n` +
      `We've added some exciting new features to Daynotes:\n\n` +
      features.map(f => `- ${f}`).join('\n') +
      `\n\nLog in to check them out!\n\n` +
      `The Daynotes Team`,
    html: (features: string[]) => 
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(to right, #3b4e87, #6c88c4); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Daynotes</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #eaeaea; border-top: none;">
          <h2>New Features in Daynotes!</h2>
          <p>We've added some exciting new features to enhance your Daynotes experience:</p>
          <ul style="list-style-type: none; padding: 0;">
            ${features.map(f => `<li style="margin-bottom: 10px; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0; color: #3b4e87;">✓</span> ${f}
            </li>`).join('')}
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://daynotes.app/login" style="background-color: #3b4e87; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Log In to Explore</a>
          </div>
          <p>Thanks for being a valued Daynotes user!</p>
          <p>Best regards,<br>The Daynotes Team</p>
        </div>
        <div style="background-color: #f7f7f7; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>
            &copy; ${new Date().getFullYear()} Daynotes. All rights reserved.<br>
            <a href="https://daynotes.app/unsubscribe" style="color: #999; text-decoration: none;">Unsubscribe</a>
          </p>
        </div>
      </div>`
  }
};

// Email sending interface
interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

// Core email sending function
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn("No SendGrid API key provided. Email not sent:", params.subject);
      return false;
    }
    
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    
    console.log(`Email sent successfully to ${params.to}: ${params.subject}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

// FROM email address should be verified in SendGrid
const FROM_EMAIL = 'notifications@daynotes.app';

// Helper functions for specific email types
export async function sendPasswordResetEmail(
  toEmail: string, 
  resetToken: string, 
  userId: number
): Promise<boolean> {
  const resetLink = `${process.env.APP_URL || 'https://daynotes.app'}/reset-password?token=${resetToken}&id=${userId}`;
  
  return sendEmail({
    to: toEmail,
    from: FROM_EMAIL,
    subject: EMAIL_TEMPLATES.PASSWORD_RESET.subject,
    text: EMAIL_TEMPLATES.PASSWORD_RESET.text(resetLink),
    html: EMAIL_TEMPLATES.PASSWORD_RESET.html(resetLink)
  });
}

export async function sendWelcomeEmail(
  toEmail: string,
  name: string
): Promise<boolean> {
  return sendEmail({
    to: toEmail,
    from: FROM_EMAIL,
    subject: EMAIL_TEMPLATES.WELCOME.subject,
    text: EMAIL_TEMPLATES.WELCOME.text(name),
    html: EMAIL_TEMPLATES.WELCOME.html(name)
  });
}

export async function sendMarketingEmail(
  toEmails: string[],
  features: string[]
): Promise<{ success: number; failure: number }> {
  let success = 0;
  let failure = 0;
  
  // For bulk sending, we process in batches and track success/failure
  for (const email of toEmails) {
    const result = await sendEmail({
      to: email,
      from: FROM_EMAIL,
      subject: EMAIL_TEMPLATES.MARKETING.subject,
      text: EMAIL_TEMPLATES.MARKETING.text(features),
      html: EMAIL_TEMPLATES.MARKETING.html(features)
    });
    
    if (result) success++;
    else failure++;
  }
  
  return { success, failure };
}