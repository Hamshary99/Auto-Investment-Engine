import { randomUUID } from "crypto";
import { User } from "../src/entities/User";
import { UserRepository } from "../src/repositories/user.repository";

/**
 * In-memory stand-in for UserRepository. Same shape as the real one, but
 * backed by a Map — no Postgres needed. Lets us unit-test AuthService
 * without spinning up a DB.
 */
export class FakeUserRepository extends UserRepository {
  private byEmail = new Map<string, User>();
  private byId = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    return this.byEmail.get(email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  async create(input: { email: string; passwordHash: string }): Promise<User> {
    const user: User = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
    };
    this.byEmail.set(user.email, user);
    this.byId.set(user.id, user);
    return user;
  }

  // test-only helpers
  size(): number { return this.byEmail.size; }
  reset(): void { this.byEmail.clear(); this.byId.clear(); }
}
