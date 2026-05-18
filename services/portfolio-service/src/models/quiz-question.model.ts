import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { QuizAnswer } from "./quiz-answer.model";

/**
 * QuizQuestion = active or inactive risk survey questions for quiz-based plan creation.
 */
@Entity({ name: "quiz_questions", schema: "portfolio" })
export class QuizQuestion {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  text!: string;

  @Column({ type: "int", default: 0 })
  displayOrder!: number;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @OneToMany(() => QuizAnswer, (answer) => answer.question)
  answers!: QuizAnswer[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
