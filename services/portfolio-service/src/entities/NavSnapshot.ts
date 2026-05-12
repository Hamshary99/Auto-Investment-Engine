import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "nav_snapshots", schema: "portfolio" })
@Unique(["portfolioId", "forDate"])
export class NavSnapshot {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  portfolioId!: string;

  @Column({ type: "date" })
  forDate!: string;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  navValue!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
