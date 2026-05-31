import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { QuizQuestion, QuizAnswer } from "@auto-invest/shared";

export class QuizRepository {
  private questionRepo(tx?: EntityManager): Repository<QuizQuestion> {
    return tx ? tx.getRepository(QuizQuestion) : AppDataSource.getRepository(QuizQuestion);
  }

  private answerRepo(tx?: EntityManager): Repository<QuizAnswer> {
    return tx ? tx.getRepository(QuizAnswer) : AppDataSource.getRepository(QuizAnswer);
  }

  findAllQuestions(tx?: EntityManager): Promise<QuizQuestion[]> {
    return this.questionRepo(tx).find({
      relations: { answers: true },
      order: { displayOrder: "ASC" },
    });
  }

  findQuestionById(id: string, tx?: EntityManager): Promise<QuizQuestion | null> {
    return this.questionRepo(tx).findOne({
      where: { id },
      relations: { answers: true },
    });
  }

  saveQuestion(question: QuizQuestion, tx?: EntityManager): Promise<QuizQuestion> {
    return this.questionRepo(tx).save(question);
  }

  createQuestion(input: Partial<QuizQuestion>, tx?: EntityManager): Promise<QuizQuestion> {
    const r = this.questionRepo(tx);
    return r.save(r.create(input));
  }

  saveAnswers(answers: QuizAnswer[], tx?: EntityManager): Promise<QuizAnswer[]> {
    return this.answerRepo(tx).save(answers);
  }

  async deleteAnswersByQuestionId(questionId: string, tx?: EntityManager): Promise<void> {
    await this.answerRepo(tx).delete({ question: { id: questionId } });
  }
}
