import { EntityManager } from "typeorm";
import { QuizRepository } from "../repository";
import { QuizQuestion, RiskProfile } from "../models/index";

export interface QuizSubmissionItem {
  questionId: string;
  answerId: string;
}

export class QuizService {
  constructor(private readonly quizRepo: QuizRepository) {}

  getActiveQuestions(tx?: EntityManager): Promise<QuizQuestion[]> {
    return this.quizRepo.findActiveQuestions(tx);
  }

  async quizScore(
    answerIds: QuizSubmissionItem[],
    tx?: EntityManager,
  ): Promise<number> {
    if (!answerIds || answerIds.length === 0) {
      throw new Error("Quiz submission must include at least one answer");
    }

    const seenQuestionIds = new Set<string>();
    let totalScore = 0;

    for (const { questionId, answerId } of answerIds) {
      if (seenQuestionIds.has(questionId)) {
        throw new Error(`Duplicate answer for question ${questionId}`);
      }

      const answer = await this.quizRepo.findAnswerById(answerId, tx);
      if (!answer) {
        throw new Error(`Answer not found: ${answerId}`);
      }

      if (!answer.question || answer.question.id !== questionId) {
        throw new Error(
          `Answer ${answerId} does not belong to question ${questionId}`,
        );
      }

      totalScore += answer.score;
      seenQuestionIds.add(questionId);
    }

    return totalScore;
  }

  calculateRiskProfile(totalScore: number, questionCount: number): RiskProfile {
    if (questionCount <= 0) {
      throw new Error("questionCount must be greater than zero");
    }

    const averageScore = totalScore / questionCount;

    if (averageScore <= 1.66) {
      return RiskProfile.Conservative;
    }

    if (averageScore <= 2.33) {
      return RiskProfile.Moderate;
    }

    return RiskProfile.Aggressive;
    }
    

  async createOrUpdateQuestionForAdmin(
    question: QuizQuestion,
    tx?: EntityManager,
  ): Promise<QuizQuestion> {
    return this.quizRepo.saveQuestion(question, tx);
  }
}
