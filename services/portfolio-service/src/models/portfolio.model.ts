import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Holding } from "./index";

@Entity({ name: "portfolios", schema: "portfolio" })
export class Portfolio {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "numeric", precision: 18, scale: 2, default: 0 })
  cashBalance!: string;

  @OneToMany(() => Holding, (h) => h.portfolio)
  holdings!: Holding[];

  @CreateDateColumn()
  createdAt!: Date;
  
}
