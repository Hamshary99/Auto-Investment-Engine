import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { ProductType, UserPortfolio } from "./index";

/**
 * SubscribedPortfolio = user has committed capital to a ProductType
 * (Madkhol: subscribed_portfolio — user's live subscription instance).
 *
 * Dollar flows only; share positions aggregate in Holding (no product attribution).
 */
@Entity({ name: "subscribed_portfolios", schema: "portfolio" })
@Unique(["userPortfolio", "productType", "planId"])
export class SubscribedPortfolio {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", nullable: true })
  planId?: string | null;

  @Index()
  @ManyToOne(() => UserPortfolio, { onDelete: "CASCADE" })
  userPortfolio!: UserPortfolio;

  @Index()
  @ManyToOne(() => ProductType, { onDelete: "RESTRICT" })
  productType!: ProductType;

  @Column({ type: "numeric", precision: 18, scale: 2, default: 0 })
  investedAmount!: string;

  @Column({ type: "numeric", precision: 18, scale: 2, default: 0 })
  redeemedAmount!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
