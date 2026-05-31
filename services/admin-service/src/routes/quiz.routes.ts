import { Router } from "express";
import { QuizController } from "../controllers/quiz.controller";
import { requireAdminAuth } from "../middleware/admin-auth.middleware";

export function buildQuizRouter(controller: QuizController): Router {
  const router = Router();

  router.use("/quiz/questions", requireAdminAuth);

  router.post("/quiz/questions", controller.createQuestion);
  router.get("/quiz/questions", controller.listQuestions);

  return router;
}
