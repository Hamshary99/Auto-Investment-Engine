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
import { Fund, Portfolio } from "./index";

/**
 * FundInvestment = the link between a Portfolio and a Fund.
 *
 * "Portfolio P has invested $X cumulatively into Fund F."
 *
 * This is NOT a position in shares — it records the dollars the portfolio
 * committed to a fund's strategy over time. Actual share ownership lives
 * in `Holding` (aggregated by symbol, no fund attribution).
 *
 * If we ever need per-fund share attribution for rebalancing, that should
 * be a separate lots/attribution table — do not pollute `Holding`.
 */
@Entity({ name: "fund_investments", schema: "portfolio" })
@Unique(["portfolio", "fund"])
export class FundInvestment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @ManyToOne(() => Portfolio, { onDelete: "CASCADE" })
  portfolio!: Portfolio;

  @Index()
  @ManyToOne(() => Fund, { onDelete: "RESTRICT" })
  fund!: Fund;

  /** Cumulative dollars committed by this portfolio to this fund (never decreases). */
  @Column({ type: "numeric", precision: 18, scale: 2, default: 0 })
  investedAmount!: string;

  /**
   * Cumulative dollars withdrawn from this portfolio's commitment to this fund.
   * Net committed = investedAmount − withdrawnAmount. This is a dollar-flow
   * record, NOT a realized-P&L number — we do not track per-fund share lots,
   * so we cannot attribute gains/losses to a fund.
   */
  @Column({ type: "numeric", precision: 18, scale: 2, default: 0 })
  withdrawnAmount!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
