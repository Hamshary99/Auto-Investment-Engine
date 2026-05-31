import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { ProductType } from "./index";

/**
 * AssociatedIndexFund = target weight of one index fund / symbol inside a ProductType
 * (Madkhol: portfolio / product-type ↔ index_fund association at catalog level).
 */
@Entity({ name: "associated_index_funds", schema: "catalog" })
@Unique(["productType", "symbol"])
export class AssociatedIndexFund {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => ProductType, (pt) => pt.associatedIndexFunds, { onDelete: "CASCADE" })
  productType!: ProductType;

  @Column({ type: "varchar", length: 16 })
  symbol!: string;

  @Column({ type: "numeric", precision: 5, scale: 4, default: 0 })
  targetWeight!: number;
}
