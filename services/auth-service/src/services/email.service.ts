import { Resend } from "resend";
import { config } from "../config";
import { logger } from "../utils/logger";

export class EmailService {
  private readonly client: Resend | null;

  constructor() {
    this.client = config.email.resendApiKey ? new Resend(config.email.resendApiKey) : null;
    if (!this.client) {
      logger.warn("RESEND_API_KEY not set — verification emails will be logged instead of sent");
    }
  }

  async sendVerification(to: string, token: string): Promise<void> {
    const link = `${config.email.appUrl}/auth/verify?token=${encodeURIComponent(token)}`;
    const subject = "Confirm your email";
    const html = `
      <p>Welcome to Auto Invest.</p>
      <p>Click the link below to confirm your email address. The link expires in ${config.email.verificationTtlHours} hours.</p>
      <p><a href="${link}">Confirm email</a></p>
      <p>If you didn't create this account, you can ignore this message.</p>
    `;

    if (!this.client) {
      logger.info({ to, link }, "verification email (dev mode, not sent)");
      return;
    }

    const { error } = await this.client.emails.send({
      from: config.email.from,
      to,
      subject,
      html,
    });
    if (error) {
      logger.error({ err: error, to }, "failed to send verification email");
      throw new Error("failed to send verification email");
    }
  }
}
