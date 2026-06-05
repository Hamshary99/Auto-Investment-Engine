import { QuizService } from "../src/services/quiz.service";

describe("QuizService", () => {
  let service: QuizService;
  let quizRepo: any;

  beforeEach(() => {
    quizRepo = {
      findAllQuestions: jest.fn(),
      findActiveQuestions: jest.fn(),
      findAnswersForQuestion: jest.fn(),
      saveQuestion: jest.fn(),
      findQuestionById: jest.fn(),
      saveAnswers: jest.fn(),
      deleteQuestion: jest.fn(),
      deleteAnswer: jest.fn(),
      inactivateQuestion: jest.fn(),
    };
    service = new QuizService(quizRepo);
  });

  describe("getQuestions", () => {
    it("returns all questions", async () => {
      quizRepo.findAllQuestions.mockResolvedValue([{ id: "q1" }]);
      const result = await service.getQuestions();
      expect(result).toEqual([{ id: "q1" }]);
    });
  });

  describe("getActiveQuestions", () => {
    it("returns active questions", async () => {
      quizRepo.findActiveQuestions.mockResolvedValue([{ id: "q2" }]);
      const result = await service.getActiveQuestions();
      expect(result).toEqual([{ id: "q2" }]);
    });
  });

  describe("getAnswersForQuestion", () => {
    it("returns answers for a question", async () => {
      quizRepo.findAnswersForQuestion.mockResolvedValue([{ id: "a1" }]);
      const result = await service.getAnswersForQuestion("q1");
      expect(result).toEqual([{ id: "a1" }]);
    });
  });

  describe("createQuestion", () => {
    it("creates a question", async () => {
      quizRepo.saveQuestion.mockResolvedValue({ id: "q1" });
      const result = await service.createQuestion({ text: "question?" } as any);
      expect(result).toEqual({ id: "q1" });
    });
  });

  describe("createAnswers", () => {
    it("throws error if question not found", async () => {
      quizRepo.findQuestionById.mockResolvedValue(null);
      await expect(service.createAnswers([{ text: "ans" }] as any, "q1")).rejects.toThrow("Question not found with id: q1");
    });

    it("creates answers and links them to question", async () => {
      const question = { id: "q1" };
      quizRepo.findQuestionById.mockResolvedValue(question);
      quizRepo.saveAnswers.mockResolvedValue([{ id: "a1", question }]);

      const result = await service.createAnswers([{ text: "ans" }] as any, "q1");

      expect(quizRepo.saveAnswers).toHaveBeenCalledWith([{ text: "ans", question }], undefined);
      expect(result).toEqual([{ id: "a1", question }]);
    });
  });

  describe("createQuestionWithAnswers", () => {
    it("throws error if question text is empty", async () => {
      await expect(service.createQuestionWithAnswers({ text: "   " } as any, [])).rejects.toThrow("Question has an empty text");
    });

    it("throws error if any answer text is empty", async () => {
      quizRepo.saveQuestion.mockResolvedValue({ id: "q1" });
      await expect(service.createQuestionWithAnswers({ text: "q1" } as any, [{ text: "  " }] as any)).rejects.toThrow("has an empty text");
    });

    it("saves question and answers with ascending scores", async () => {
      const que = { id: "q1", text: "q1 text" };
      quizRepo.saveQuestion.mockResolvedValue(que);
      quizRepo.saveAnswers.mockImplementation(async (ans: any) => ans);

      const answers: any[] = [{ text: "a1" }, { text: "a2" }];
      const result = await service.createQuestionWithAnswers({ text: "q1 text" } as any, answers);

      expect(quizRepo.saveQuestion).toHaveBeenCalled();
      expect(quizRepo.saveAnswers).toHaveBeenCalledWith(
        [
          { text: "a1", question: que, score: 1 },
          { text: "a2", question: que, score: 2 },
        ],
        undefined
      );
      expect(result).toEqual({ ...que, answers: answers });
    });
  });

  describe("updateQuestion", () => {
    it("updates and saves question", async () => {
      quizRepo.saveQuestion.mockResolvedValue({ id: "q1" });
      const result = await service.updateQuestion({ id: "q1" } as any);
      expect(result).toEqual({ id: "q1" });
    });
  });

  describe("updateAnswer", () => {
    it("updates and saves answer", async () => {
      quizRepo.saveAnswers.mockResolvedValue([{ id: "a1" }]);
      const result = await service.updateAnswer({ id: "a1" });
      expect(result).toEqual({ id: "a1" });
    });
  });

  describe("deleteQuestion", () => {
    it("deletes a question", async () => {
      await service.deleteQuestion("q1");
      expect(quizRepo.deleteQuestion).toHaveBeenCalledWith("q1", undefined);
    });
  });

  describe("deleteAnswer", () => {
    it("deletes an answer", async () => {
      await service.deleteAnswer("a1");
      expect(quizRepo.deleteAnswer).toHaveBeenCalledWith("a1", undefined);
    });
  });

  describe("inactivateQuestion", () => {
    it("inactivates a question", async () => {
      await service.inactivateQuestion("q1");
      expect(quizRepo.inactivateQuestion).toHaveBeenCalledWith("q1", undefined);
    });
  });
});
