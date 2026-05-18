import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { QuizQuestion } from "./quiz-question.model";

/**
 * QuizAnswer = answer option for a quiz question, including score used to derive risk profile.
 */
@Entity({ name: "quiz_answers", schema: "portfolio" })
export class QuizAnswer {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => QuizQuestion, (question) => question.answers, {
    onDelete: "CASCADE",
  })
  question!: QuizQuestion;

  @Column({ type: "text" })
  text!: string;

  @Column({ type: "int" })
  score!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
