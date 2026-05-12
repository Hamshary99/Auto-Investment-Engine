import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export type OrderStatus = "PENDING" | "EXECUTED" | "FAILED";
export type OrderSide = "BUY" | "SELL";

@Entity({ name: "orders", schema: "portfolio" })
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 16 })
  symbol!: string;

  @Column({ type: "varchar", length: 4 })
  side!: OrderSide;

  @Column({ type: "numeric", precision: 18, scale: 6 })
  quantity!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, nullable: true })
  executedPrice?: string | null;

  @Index()
  @Column({ type: "varchar", length: 16, default: "PENDING" })
  status!: OrderStatus;

  @Column({ type: "text", nullable: true })
  failureReason?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
