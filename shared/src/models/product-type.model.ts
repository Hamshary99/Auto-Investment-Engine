import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AssociatedIndexFund } from "./index";
import { RiskProfile } from "./types";

export { RiskProfile };

/**
 * ProductType = sellable investment line (Madkhol: product_type — Savings, Tech, etc.).
 *
 * Admin-defined. Users subscribe via SubscribedPortfolio and add fund over time.
 * Underlying symbol weights live in AssociatedIndexFund rows.
 */
@Entity({ name: "product_types", schema: "catalog" })
export class ProductType {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "enum", enum: RiskProfile, enumName: "risk_profile" })
  riskProfile!: RiskProfile;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => AssociatedIndexFund, (a) => a.productType)
  associatedIndexFunds!: AssociatedIndexFund[];
}
