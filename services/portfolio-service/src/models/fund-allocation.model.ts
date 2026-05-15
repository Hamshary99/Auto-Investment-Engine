import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Fund } from "./index";

/**
 * FundAllocation = one line of a Fund's *recipe* (target weight per symbol).
 *
 * This is NOT an owned share. A FundAllocation is a template row that says
 * "Fund F should target weight W of symbol S".
 *
 *   Tech Growth Fund
 *     FundAllocation(AAPL, 0.60)   ← recipe
 *     FundAllocation(MSFT, 0.40)   ← recipe
 *
 * The actual owned-share equivalent for a user's portfolio is `Holding`.
 */
@Entity({ name: "fund_allocations", schema: "portfolio" })
@Unique(["fund", "symbol"])
export class FundAllocation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Fund, (f) => f.allocations, { onDelete: "CASCADE" })
  fund!: Fund;

  @Column({ type: "varchar", length: 16 })
  symbol!: string;

  /** 0–1 fraction (0.4000 = 40%). Per-fund weights should sum to ~1.0. */
  @Column({ type: "numeric", precision: 5, scale: 4, default: 0 })
  targetWeight!: number;
}
