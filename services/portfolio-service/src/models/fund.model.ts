import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { FundAllocation } from "./index";

export type RiskProfile = "conservative" | "moderate" | "aggressive";

/**
 * Fund = admin-defined investment strategy / template.
 *
 * A Fund is NOT owned by a user or a portfolio. It's a named recipe of
 * target weights (see `FundAllocation`). Users invest INTO funds — the
 * link between a portfolio and the funds it has bought into is the
 * `FundInvestment` table.
 */
@Entity({ name: "funds", schema: "portfolio" })
export class Fund {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 20 })
  riskProfile!: RiskProfile;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  /** Recipe rows — target weights per symbol. Sum should be ~1.0. */
  @OneToMany(() => FundAllocation, (a) => a.fund)
  allocations!: FundAllocation[];
}
