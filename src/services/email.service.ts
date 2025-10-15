import nodemailer from 'nodemailer';
import { ENV } from '../config/env';
import { EmailConfig } from '../types';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: ENV.SMTP_USER && ENV.SMTP_PASS ? {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      } : undefined,
    });
  }

  /**
   * Sets template ID for email service
   */
  setTemplateId(): string {
    // This would typically integrate with an email template service
    return 'default-integration-template';
  }

  /**
   * Sends an email using the configured transporter
   */
  async sendEmail(emailConfig: EmailConfig): Promise<void> {
    try {
      const mailOptions = {
        from: ENV.EMAIL_FROM,
        to: emailConfig.templateParams.to_email,
        subject: emailConfig.templateParams.subject || 'Integration Alert',
        html: this.buildEmailTemplate(emailConfig),
        text: this.buildTextTemplate(emailConfig)
      };

      // Only send if SMTP is configured
      if (ENV.SMTP_HOST && ENV.SMTP_HOST !== 'localhost') {
        await this.transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${emailConfig.templateParams.to_email}`);
      } else {
        console.log('SMTP not configured, logging email instead:', mailOptions);
      }

    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error(`Failed to send email: ${error}`);
    }
  }

  /**
   * Builds HTML email template
   */
  private buildEmailTemplate(emailConfig: EmailConfig): string {
    const { templateParams } = emailConfig;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${templateParams.subject || 'Integration Alert'}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
            .content { background-color: #ffffff; padding: 20px; border-radius: 5px; border: 1px solid #dee2e6; }
            .error { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 10px; border-radius: 5px; margin: 10px 0; }
            .footer { margin-top: 20px; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Integration Alert</h1>
              <p><strong>To:</strong> ${templateParams.to_name}</p>
            </div>

            <div class="content">
              ${templateParams.method_name ? `<p><strong>Method:</strong> ${templateParams.method_name}</p>` : ''}
              ${templateParams.method_location ? `<p><strong>Location:</strong> ${templateParams.method_location}</p>` : ''}

              ${templateParams.message ? `
                <div class="error">
                  <strong>Message:</strong><br>
                  ${templateParams.message.replace(/\n/g, '<br>')}
                </div>
              ` : ''}

              <p>If you need assistance, please contact the integration team.</p>
            </div>

            <div class="footer">
              <p>This is an automated message from the HubSpot-NetSuite Integration System.</p>
              <p>Timestamp: ${new Date().toISOString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Builds plain text email template
   */
  private buildTextTemplate(emailConfig: EmailConfig): string {
    const { templateParams } = emailConfig;

    let text = `Integration Alert\n\n`;
    text += `To: ${templateParams.to_name}\n\n`;

    if (templateParams.method_name) {
      text += `Method: ${templateParams.method_name}\n`;
    }

    if (templateParams.method_location) {
      text += `Location: ${templateParams.method_location}\n`;
    }

    if (templateParams.message) {
      text += `\nMessage:\n${templateParams.message}\n`;
    }

    text += `\nIf you need assistance, please contact the integration team.\n\n`;
    text += `Timestamp: ${new Date().toISOString()}\n`;
    text += `This is an automated message from the HubSpot-NetSuite Integration System.`;

    return text;
  }

  /**
   * Sends a test email to verify configuration
   */
  async sendTestEmail(): Promise<void> {
    const testConfig: EmailConfig = {
      templateId: this.setTemplateId(),
      templateParams: {
        to_name: ENV.DEFAULT_ERROR_TO_NAME,
        to_email: ENV.DEFAULT_ERROR_EMAIL_ADDRESS,
        subject: 'Test Email - HubSpot-NetSuite Integration',
        method_name: 'sendTestEmail',
        message: 'This is a test email to verify that the email service is configured correctly.'
      }
    };

    await this.sendEmail(testConfig);
  }
}

export default new EmailService();