import { QuizRepository, QuizQuestion, QuizAnswer } from "@auto-invest/shared";
import { EntityManager } from "typeorm";

export class QuizService {
  constructor(private readonly quizRepo: QuizRepository) { }

  async getQuestions(tx?: EntityManager): Promise<QuizQuestion[]> {
    return this.quizRepo.findAllQuestions(tx as any);
  }

  async getActiveQuestions(tx?: EntityManager): Promise<QuizQuestion[]> {
    return this.quizRepo.findActiveQuestions(tx as any);
  }

  async getAnswersForQuestion(questionId: string, tx?: EntityManager): Promise<QuizAnswer[]> {
    return this.quizRepo.findAnswersForQuestion(questionId, tx as any);
  }

  async createQuestion(question: QuizQuestion, tx?: EntityManager): Promise<QuizQuestion> {
    return this.quizRepo.saveQuestion(question, tx as any);
  }

  async createAnswers(answers: QuizAnswer[], questionId: string, tx?: EntityManager): Promise<QuizAnswer[]> {
    const question = await this.quizRepo.findQuestionById(questionId, tx as any);
    if (!question) {
      throw new Error(`Question not found with id: ${questionId}`);
    }
    answers.forEach((answer) => {
      answer.question = question;
    });
    
    const createdAnswers = await this.quizRepo.saveAnswers(answers, tx as any);
    return createdAnswers;
  }

  async createQuestionWithAnswers(question: QuizQuestion, answers: QuizAnswer[], tx?: EntityManager): Promise<QuizQuestion & { answers: QuizAnswer[] }> {
    if(question.text.trim() === '') throw new Error(`Question has an empty text`)
      const que = await this.quizRepo.saveQuestion(question, tx as any);
    
    let answerScore = 1;
    for( let a of answers ) {
      if(a.text.trim() === '') throw new Error(`Answer ${a.id} has an empty text`)

        a.question = que;
        a.score = answerScore;
        answerScore++;
    }
    
    const createdAnswers = await this.quizRepo.saveAnswers(answers, tx as any);
    return { ...que, answers: createdAnswers };
  }

  async updateQuestion(question: QuizQuestion, tx?: EntityManager): Promise<QuizQuestion> {
    return this.quizRepo.saveQuestion(question, tx as any);
  }

  async updateAnswer(answer: Partial<QuizAnswer>, tx?: EntityManager): Promise<QuizAnswer> {
    const savedAnswers = await this.quizRepo.saveAnswers([answer as QuizAnswer], tx as any);
    return savedAnswers[0];
  }

  async deleteQuestion(questionId: string, tx?: EntityManager): Promise<void> {
    await this.quizRepo.deleteQuestion(questionId, tx as any);
  }

  async deleteAnswer(answerId: string, tx?: EntityManager): Promise<void> {
    await this.quizRepo.deleteAnswer(answerId, tx as any);
  }

  async inactivateQuestion(questionId: string, tx?: EntityManager): Promise<void> {
    await this.quizRepo.inactivateQuestion(questionId, tx as any);
  }
}
