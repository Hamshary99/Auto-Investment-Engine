import { randomUUID } from "crypto";
import { QuizRepository } from "../../src/repository/quiz.repository";
import { QuizQuestion } from "../../src/models/quiz-question.model";
import { QuizAnswer } from "../../src/models/quiz-answer.model";

export class FakeQuizRepository extends QuizRepository {
  private questions = new Map<string, QuizQuestion>();
  private answers   = new Map<string, QuizAnswer>();

  // ── seed helpers ──────────────────────────────────────────────────────────

  seedQuestion(q: { id?: string; text?: string; displayOrder?: number; isActive?: boolean; answers?: Array<{ text: string; score: number }> }): QuizQuestion {
    const question: QuizQuestion = {
      id:           q.id ?? randomUUID(),
      text:         q.text ?? "Sample question?",
      displayOrder: q.displayOrder ?? 0,
      isActive:     q.isActive ?? true,
      answers:      [],
      createdAt:    new Date(),
      updatedAt:    new Date(),
    };

    for (const raw of q.answers ?? []) {
      const answer: QuizAnswer = {
        id:        randomUUID(),
        question,
        text:      raw.text,
        score:     raw.score,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      question.answers.push(answer);
      this.answers.set(answer.id, answer);
    }

    this.questions.set(question.id, question);
    return question;
  }

  // ── overrides ─────────────────────────────────────────────────────────────

  async findActiveQuestions(): Promise<QuizQuestion[]> {
    return [...this.questions.values()]
      .filter((q) => q.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async findAnswerById(answerId: string): Promise<QuizAnswer | null> {
    return this.answers.get(answerId) ?? null;
  }

  async saveQuestion(question: QuizQuestion): Promise<QuizQuestion> {
    if (!question.id) question.id = randomUUID();
    this.questions.set(question.id, question);
    return question;
  }

  async saveAnswer(answer: QuizAnswer): Promise<QuizAnswer> {
    if (!answer.id) answer.id = randomUUID();
    this.answers.set(answer.id, answer);
    return answer;
  }

  // ── inspection helpers ────────────────────────────────────────────────────
  allQuestions(): QuizQuestion[] { return [...this.questions.values()]; }
  allAnswers():   QuizAnswer[]   { return [...this.answers.values()]; }
}
