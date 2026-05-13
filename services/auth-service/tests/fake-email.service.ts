import { EmailService } from "../src/services/email.service";

export class FakeEmailService extends EmailService {
  public sent: { to: string; token: string }[] = [];

  async sendVerification(to: string, token: string): Promise<void> {
    this.sent.push({ to, token });
  }

  lastTokenFor(email: string): string | undefined {
    return [...this.sent].reverse().find((s) => s.to === email)?.token;
  }
}
