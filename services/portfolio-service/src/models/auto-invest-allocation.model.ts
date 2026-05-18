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
import { AutoInvestPlan } from "./auto-invest-plan.model";
import { ProductType } from "./product-type.model";

@Entity({ name: "auto_invest_allocations", schema: "portfolio" })
@Unique(["plan", "productType"])
export class AutoInvestAllocation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @ManyToOne(() => AutoInvestPlan, (plan) => plan.allocations, {
    onDelete: "CASCADE",
  })
  plan!: AutoInvestPlan;

  @Index()
  @ManyToOne(() => ProductType, { onDelete: "RESTRICT" })
  productType!: ProductType;

  @Column({ type: "numeric", precision: 5, scale: 4, default: 0 })
  weight!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
