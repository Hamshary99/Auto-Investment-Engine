import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { Portfolio } from "./Portfolio";

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
