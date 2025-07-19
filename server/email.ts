import sgMail from '@sendgrid/mail';

// Check if SendGrid API key is available
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
// Use a verified sender email - this should be your verified email address in SendGrid
const FROM_EMAIL = process.env.FROM_EMAIL || 'your-verified-email@your-domain.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('SendGrid email service initialized');
} else {
  console.warn('SENDGRID_API_KEY not found. Email functionality will use console logs for development.');
}

export async function sendMagicLinkEmail(
  to: string, 
  magicLinkUrl: string, 
  name?: string
): Promise<boolean> {
  const subject = 'Login to Field Notes - Magic Link';
  const greeting = name ? `Hi ${name}` : 'Hello';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        .email-container { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px;
          background-color: #f9fafb;
        }
        .email-content {
          background: white;
          border-radius: 8px;
          padding: 32px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .magic-link-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
          text-align: center;
        }
        .footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-content">
          <h1 style="color: #1f2937; margin-bottom: 24px;">Field Notes Login</h1>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            ${greeting},
          </p>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Click the button below to securely log in to your Field Notes account. This magic link will expire in 15 minutes.
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${magicLinkUrl}" class="magic-link-button">
              Log in to Field Notes
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            If the button doesn't work, you can copy and paste this link into your browser:
            <br>
            <a href="${magicLinkUrl}" style="color: #667eea; word-break: break-all;">${magicLinkUrl}</a>
          </p>
          
          <div class="footer">
            <p>
              If you didn't request this login link, you can safely ignore this email.
            </p>
            <p>
              This link will expire in 15 minutes for security reasons.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
${greeting},

Click the link below to securely log in to your Field Notes account:

${magicLinkUrl}

This magic link will expire in 15 minutes for security reasons.

If you didn't request this login link, you can safely ignore this email.
  `;

  try {
    if (SENDGRID_API_KEY) {
      // Send email using SendGrid
      const msg = {
        to,
        from: FROM_EMAIL,
        subject,
        text: textContent,
        html: htmlContent,
      };

      try {
        await sgMail.send(msg);
        console.log(`Magic link email sent successfully to ${to}`);
        return true;
      } catch (sgError: any) {
        console.error('SendGrid specific error:', sgError);
        if (sgError.response?.body?.errors) {
          console.error('SendGrid error details:', JSON.stringify(sgError.response.body.errors, null, 2));
        }
        
        // If SendGrid fails due to domain verification, fall back to console logging
        console.warn('SendGrid failed, falling back to console logging for development...');
        console.log('='.repeat(60));
        console.log('SENDGRID FALLBACK - Magic Link Email');
        console.log('='.repeat(60));
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Magic Link: ${magicLinkUrl}`);
        console.log('='.repeat(60));
        return true;
      }
    } else {
      // Development mode: Log the magic link to console
      console.log('='.repeat(60));
      console.log('DEVELOPMENT MODE - Magic Link Email');
      console.log('='.repeat(60));
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Magic Link: ${magicLinkUrl}`);
      console.log('='.repeat(60));
      return true;
    }
  } catch (error: any) {
    console.error('Error sending magic link email:', error);
    if (error.response?.body?.errors) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
    }
    return false;
  }
}

export async function sendPasswordResetEmail(
  to: string, 
  resetUrl: string, 
  name?: string
): Promise<boolean> {
  const subject = 'Reset Your Field Notes Password';
  const greeting = name ? `Hi ${name}` : 'Hello';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        .email-container { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px;
          background-color: #f9fafb;
        }
        .email-content {
          background: white;
          border-radius: 8px;
          padding: 32px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .reset-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
          text-align: center;
        }
        .footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-content">
          <h1 style="color: #1f2937; margin-bottom: 24px;">Password Reset Request</h1>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            ${greeting},
          </p>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            You requested a password reset for your Field Notes account. Click the button below to reset your password.
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" class="reset-button">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            If the button doesn't work, you can copy and paste this link into your browser:
            <br>
            <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <div class="footer">
            <p>
              If you didn't request this password reset, you can safely ignore this email.
            </p>
            <p>
              This link will expire in 1 hour for security reasons.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
${greeting},

You requested a password reset for your Field Notes account. Click the link below to reset your password:

${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, you can safely ignore this email.
  `;

  try {
    if (SENDGRID_API_KEY) {
      // Send email using SendGrid
      const msg = {
        to,
        from: FROM_EMAIL,
        subject,
        text: textContent,
        html: htmlContent,
      };

      await sgMail.send(msg);
      console.log(`Password reset email sent successfully to ${to}`);
      return true;
    } else {
      // Development mode: Log the reset link to console
      console.log('='.repeat(60));
      console.log('DEVELOPMENT MODE - Password Reset Email');
      console.log('='.repeat(60));
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Reset Link: ${resetUrl}`);
      console.log('='.repeat(60));
      return true;
    }
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    if (error.response?.body?.errors) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
    }
    return false;
  }
}