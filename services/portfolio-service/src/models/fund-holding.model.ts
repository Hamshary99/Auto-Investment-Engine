import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Fund } from "./index";

@Entity({ name: "fund_holdings", schema: "portfolio" })
@Unique(["portfolio", "fund"])
export class FundHolding {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Fund, (f) => f.fundHolding, { onDelete: "CASCADE" })
    fund!: Fund;

    @Column({ type: "string", nullable: false })
    symbol!: string;

    @Column({ type: "numeric", precision: 5, scale: 4, default: 0 })
    targetWeight!: number;
}