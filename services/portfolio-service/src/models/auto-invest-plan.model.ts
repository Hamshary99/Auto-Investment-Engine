import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AutoInvestAllocation } from "./auto-invest-allocation.model";
import { RiskProfile } from "./types";

@Entity({ name: "auto_invest_plans", schema: "portfolio" })
export class AutoInvestPlan {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 80 })
  name!: string;

  @Column({ type: "enum", enum: RiskProfile, enumName: "risk_profile" })
  riskProfile!: RiskProfile;

  @Column({ type: "numeric", precision: 18, scale: 2, default: 0 })
  cashBalance!: string;

  @Column({ type: "numeric", precision: 18, scale: 2, default: 0 })
  reservedCash!: string;

  @Column({ type: "numeric", precision: 18, scale: 2, default: 0 })
  investedAmount!: string;

  @Column({ type: "numeric", precision: 5, scale: 4, default: 0.01 })
  reservePct!: number;

  @Column({ type: "boolean", default: true })
  autoInvest!: boolean;

  @OneToMany(() => AutoInvestAllocation, (allocation) => allocation.plan)
  allocations!: AutoInvestAllocation[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
