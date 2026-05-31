import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export enum AdminRole {
  SUPER_ADMIN = "super_admin",
  CATALOG_ADMIN = "catalog_admin",
}

@Entity({ name: "admin_users", schema: "admin" })
export class AdminUser {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({
    type: "enum",
    enum: AdminRole,
    default: AdminRole.CATALOG_ADMIN,
  })
  role!: AdminRole;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
