// ─────────────────────────────────────────────────────────────────────────────
//  quiz.service.test.ts
//
//  Covers QuizService:
//    • calculateRiskProfile  – pure scoring logic, no I/O
//    • quizScore             – DB-backed score summation via FakeQuizRepository
//
//  Console output format:  INPUT → ACT → OUTPUT  per describe block.
// ─────────────────────────────────────────────────────────────────────────────

import { QuizService }        from "../src/services/quiz.service";
import { FakeQuizRepository } from "./fakes/fake-quiz.repository";
import { RiskProfile }        from "../src/models/types";

// ── shared pretty-printer ────────────────────────────────────────────────────

function logTestIO(label: string, input: unknown, output: unknown) {
  const sep = "─".repeat(60);
  console.log(`\n${sep}\n  🧪  ${label}\n  📥  INPUT  : ${JSON.stringify(input)}\n  📤  OUTPUT : ${JSON.stringify(output)}\n${sep}`);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildSut() {
  const repo    = new FakeQuizRepository();
  const service = new QuizService(repo);
  return { service, repo };
}

// ════════════════════════════════════════════════════════════════════════════
//  QuizService.calculateRiskProfile
//  Pure function: (totalScore, questionCount) → RiskProfile
//
//  Scoring bands (averageScore = totalScore / questionCount):
//    ≤ 1.66  → conservative
//    ≤ 2.33  → moderate
//    > 2.33  → aggressive
// ════════════════════════════════════════════════════════════════════════════
describe("QuizService.calculateRiskProfile", () => {

  it("returns Conservative when average score ≤ 1.66", () => {
    const { service } = buildSut();
    const input  = { totalScore: 3, questionCount: 3 }; // avg = 1.0
    const output = service.calculateRiskProfile(input.totalScore, input.questionCount);

    logTestIO("calculateRiskProfile → Conservative", input, output);

    expect(output).toBe(RiskProfile.Conservative);
  });

  it("returns Moderate when average score is between 1.67 and 2.33", () => {
    const { service } = buildSut();
    const input  = { totalScore: 6, questionCount: 3 }; // avg = 2.0
    const output = service.calculateRiskProfile(input.totalScore, input.questionCount);

    logTestIO("calculateRiskProfile → Moderate", input, output);

    expect(output).toBe(RiskProfile.Moderate);
  });

  it("returns Aggressive when average score > 2.33", () => {
    const { service } = buildSut();
    const input  = { totalScore: 9, questionCount: 3 }; // avg = 3.0
    const output = service.calculateRiskProfile(input.totalScore, input.questionCount);

    logTestIO("calculateRiskProfile → Aggressive", input, output);

    expect(output).toBe(RiskProfile.Aggressive);
  });

  it("throws when questionCount is zero (guard against division by zero)", () => {
    const { service } = buildSut();
    const input = { totalScore: 5, questionCount: 0 };

    logTestIO("calculateRiskProfile → throws on 0 questionCount", input, "Error: questionCount must be greater than zero");

    expect(() => service.calculateRiskProfile(input.totalScore, input.questionCount))
      .toThrow("questionCount must be greater than zero");
  });

  it("boundary: average = 1.5 is safely below 1.66 → Conservative", () => {
    const { service } = buildSut();
    // totalScore = 3, questionCount = 2  →  avg = 1.5 (well below ≤ 1.66 threshold)
    const input  = { totalScore: 3, questionCount: 2 };
    const output = service.calculateRiskProfile(input.totalScore, input.questionCount);

    logTestIO("calculateRiskProfile → avg 1.5 = Conservative", input, output);

    expect(output).toBe(RiskProfile.Conservative);
  });

  it("exact boundary: average = 2.33 → Moderate", () => {
    const { service } = buildSut();
    // totalScore = 6.99, questionCount = 3  →  avg = 2.33
    const input  = { totalScore: 6.99, questionCount: 3 };
    const output = service.calculateRiskProfile(input.totalScore, input.questionCount);

    logTestIO("calculateRiskProfile → boundary 2.33 = Moderate", input, output);

    expect(output).toBe(RiskProfile.Moderate);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  QuizService.quizScore
//  Sums scores from the repo for a valid submission.
// ════════════════════════════════════════════════════════════════════════════
describe("QuizService.quizScore", () => {

  it("sums scores for a valid 3-question submission", async () => {
    const { service, repo } = buildSut();

    // seed 3 questions, each with one scoreable answer
    const q1 = repo.seedQuestion({ text: "Q1", displayOrder: 1, answers: [{ text: "Low risk",  score: 1 }] });
    const q2 = repo.seedQuestion({ text: "Q2", displayOrder: 2, answers: [{ text: "Med risk",  score: 2 }] });
    const q3 = repo.seedQuestion({ text: "Q3", displayOrder: 3, answers: [{ text: "High risk", score: 3 }] });

    const input = [
      { questionId: q1.id, answerId: q1.answers[0].id },
      { questionId: q2.id, answerId: q2.answers[0].id },
      { questionId: q3.id, answerId: q3.answers[0].id },
    ];

    // ── ACT ───────────────────────────────────────────────────────────
    const output = await service.quizScore(input);

    logTestIO("quizScore → 1+2+3 = 6", input, { totalScore: output });

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // totalScore = 1 + 2 + 3 = 6
    expect(output).toBe(6);
  });

  it("throws when submission is empty", async () => {
    const { service } = buildSut();
    const input: any[] = [];

    logTestIO("quizScore → throws on empty submission", input, "Error: Quiz submission must include at least one answer");

    await expect(service.quizScore(input)).rejects.toThrow(
      "Quiz submission must include at least one answer",
    );
  });

  it("throws when the same question is answered twice (duplicate detection)", async () => {
    const { service, repo } = buildSut();
    const q = repo.seedQuestion({ text: "Q1", answers: [{ text: "A", score: 1 }, { text: "B", score: 2 }] });

    const input = [
      { questionId: q.id, answerId: q.answers[0].id },
      { questionId: q.id, answerId: q.answers[1].id }, // duplicate question
    ];

    logTestIO("quizScore → throws on duplicate question", input, `Error: Duplicate answer for question ${q.id}`);

    await expect(service.quizScore(input)).rejects.toThrow(`Duplicate answer for question ${q.id}`);
  });

  it("throws when answerId does not exist in the repo", async () => {
    const { service, repo } = buildSut();
    const q = repo.seedQuestion({ text: "Q1", answers: [{ text: "A", score: 1 }] });

    const input = [{ questionId: q.id, answerId: "non-existent-answer-id" }];

    logTestIO("quizScore → throws on unknown answerId", input, "Error: Answer not found: non-existent-answer-id");

    await expect(service.quizScore(input)).rejects.toThrow("Answer not found: non-existent-answer-id");
  });

  it("throws when answer does not belong to the submitted question", async () => {
    const { service, repo } = buildSut();
    const q1 = repo.seedQuestion({ text: "Q1", answers: [{ text: "A1", score: 1 }] });
    const q2 = repo.seedQuestion({ text: "Q2", answers: [{ text: "A2", score: 2 }] });

    // Submit q1 but use an answer that belongs to q2
    const input = [{ questionId: q1.id, answerId: q2.answers[0].id }];

    logTestIO(
      "quizScore → throws when answer belongs to a different question",
      input,
      `Error: Answer ${q2.answers[0].id} does not belong to question ${q1.id}`,
    );

    await expect(service.quizScore(input)).rejects.toThrow(
      `Answer ${q2.answers[0].id} does not belong to question ${q1.id}`,
    );
  });
});
