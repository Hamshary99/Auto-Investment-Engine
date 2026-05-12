import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

/**
 * Inbox table for idempotent message consumption.
 * Insert messageId in the same tx as the side-effect; a duplicate triggers
 * a PK violation, which the consumer treats as "already processed → ack".
 */
@Entity({ name: "processed_messages", schema: "portfolio" })
export class ProcessedMessage {
  @PrimaryColumn({ type: "uuid" })
  messageId!: string;

  @Column({ type: "varchar", length: 64 })
  type!: string;

  @CreateDateColumn()
  processedAt!: Date;
}
