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
import { ProductType } from "./index";
import { RiskProfile } from "./types";

/**
 * RiskProfileTemplate = admin-defined allocation of product types for a risk band.
 * This is the catalog-level source for creating per-user auto-invest plans.
 */
@Entity({ name: "risk_profile_templates", schema: "portfolio" })
@Unique(["riskProfile", "productType"])
export class RiskProfileTemplate {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "enum", enum: RiskProfile, enumName: "risk_profile" })
  riskProfile!: RiskProfile;

  @ManyToOne(() => ProductType, { onDelete: "RESTRICT" })
  productType!: ProductType;

  @Column({ type: "numeric", precision: 5, scale: 4, default: 0 })
  weight!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
