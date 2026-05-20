import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { QuizController } from "../controllers/quiz.controller";
import { QuizService } from "../services/index";

export const buildQuizRouter = (quizService: QuizService) => {
  const router = Router();
  const c = new QuizController(quizService);

  router.get("/quiz", requireAuth, c.getActiveQuestions);
  router.post("/quiz/submit", requireAuth, c.submitQuiz);

  return router;
};
