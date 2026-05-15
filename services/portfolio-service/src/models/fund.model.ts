import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { FundHolding } from "./index";

export type RiskProfile = "conservative" | "moderate" | "aggressive";

@Entity({ name: "funds", schema: "portfolio" })
export class Fund {
    @PrimaryGeneratedColumn("uuid")
    id!: string; 
    
    @Column({ type: "varchar", length: 16 })
    name!: string;  
    
    @Column({ type: "text", nullable: true })
    description!: string;   
    
    @Column({ type: "varchar", length: 16 })
    riskProfile!: RiskProfile;

    @Column({ type: "boolean", default: true })
    isActive!: boolean;

    @Column({ type: "date", nullable: true })
    createdAt!: Date;
  
    @OneToMany(() => FundHolding, (fh) => fh.fund, { onDelete: "CASCADE" })
    fundHolding!: FundHolding;
}
