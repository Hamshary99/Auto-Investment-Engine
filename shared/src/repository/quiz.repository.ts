import { DataSource, EntityManager, Repository } from "typeorm";
import { QuizQuestion } from "../models/quiz-question.model";
import { QuizAnswer } from "../models/quiz-answer.model";

export class QuizRepository {
  constructor(private dataSource: DataSource) {}

  private questionRepo(tx?: EntityManager): Repository<QuizQuestion> {
    return tx
      ? tx.getRepository(QuizQuestion)
      : this.dataSource.getRepository(QuizQuestion);
  }

  private answerRepo(tx?: EntityManager): Repository<QuizAnswer> {
    return tx
      ? tx.getRepository(QuizAnswer)
      : this.dataSource.getRepository(QuizAnswer);
  }

  findActiveQuestions(tx?: EntityManager): Promise<QuizQuestion[]> {
    return this.questionRepo(tx).find({
      where: { isActive: true },
      relations: { answers: true },
      order: { displayOrder: "ASC" },
    });
  }

  findAnswerById(
    answerId: string,
    tx?: EntityManager,
  ): Promise<QuizAnswer | null> {
    return this.answerRepo(tx).findOne({
      where: { id: answerId },
      relations: { question: true },
    });
  }

  saveQuestion(
    question: QuizQuestion,
    tx?: EntityManager,
  ): Promise<QuizQuestion> {
    return this.questionRepo(tx).save(question);
  }

  saveAnswer(answer: QuizAnswer, tx?: EntityManager): Promise<QuizAnswer> {
    return this.answerRepo(tx).save(answer);
  }
}
