import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { Portfolio } from "./index";

/**
 * Holding = an *actual owned share position* inside a Portfolio.
 *
 * DO NOT confuse with `FundAllocation`:
 *   - `Holding`         → real shares the portfolio owns (qty + avgCost)
 *   - `FundAllocation`  → recipe row on a Fund (target % of a symbol)
 *
 * Aggregated by (portfolio, symbol). There is intentionally NO `fundId`
 * here — Holding represents the *net* position regardless of which fund
 * caused the BUY. If per-fund attribution is ever needed (e.g. for
 * fund-level rebalancing), introduce a separate lots/attribution table;
 * do not pollute Holding.
 */
@Entity({ name: "holdings", schema: "portfolio" })
@Unique(["portfolio", "symbol"])
export class Holding {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Portfolio, (p) => p.holdings, { onDelete: "CASCADE" })
  portfolio!: Portfolio;

  @Column({ type: "varchar", length: 16 })
  symbol!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, default: 0 })
  quantity!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, default: 0 })
  avgCost!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
