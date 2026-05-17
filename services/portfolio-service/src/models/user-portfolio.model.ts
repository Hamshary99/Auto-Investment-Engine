import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Holding } from "./index";

/**
 * UserPortfolio = a user's cash bucket and share positions (Madkhol: user_portfolio).
 *
 * Not to be confused with catalog `Portfolio` templates in Madkhol — this is the
 * per-user ledger of cash + holdings.
 */
@Entity({ name: "user_portfolios", schema: "portfolio" })
export class UserPortfolio {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "numeric", precision: 18, scale: 2, default: 0 })
  cashBalance!: string;

  @OneToMany(() => Holding, (h) => h.userPortfolio)
  holdings!: Holding[];

  @CreateDateColumn()
  createdAt!: Date;
}
