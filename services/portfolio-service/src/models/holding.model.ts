import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { UserPortfolio } from "./index";

/**
 * Holding = net share position inside a UserPortfolio (Madkhol: user_index_fund aggregate).
 *
 * No productTypeId — positions merge by symbol across all subscriptions.
 */
@Entity({ name: "holdings", schema: "portfolio" })
@Unique(["userPortfolio", "symbol", "planId"])
export class Holding {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", nullable: true })
  planId?: string | null;

  @ManyToOne(() => UserPortfolio, (p) => p.holdings, { onDelete: "CASCADE" })
  userPortfolio!: UserPortfolio;

  @Column({ type: "varchar", length: 16 })
  symbol!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, default: 0 })
  quantity!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, default: 0 })
  avgCost!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
