import { Router } from "express";
import { QuizController } from "../controllers/quiz.controller";
import { requireAdminAuth } from "../middleware/admin-auth.middleware";

export function buildQuizRouter(controller: QuizController): Router {
  const router = Router();

  router.use("/quiz", requireAdminAuth);

  router.get("/quiz/questions", controller.listQuestions);
  router.get("/quiz/questions/active", controller.listActiveQuestions);
  router.get("/quiz/questions/:id/answers", controller.listQuestionAnswers);

  router.post("/quiz/questions", controller.createQuestion);
  router.post("/quiz/questions/with-answers", controller.createQuestionWithAnswers);
  router.post("/quiz/questions/:id/answers", controller.createAnswers);

  router.put("/quiz/questions/:id", controller.updateQuestion);
  router.put("/quiz/answers/:id", controller.updateAnswer);

  router.patch("/quiz/questions/:id/inactivate", controller.inactivateQuestion);

  router.delete("/quiz/questions/:id", controller.deleteQuestion);
  router.delete("/quiz/answers/:id", controller.deleteAnswer);

  return router;
}
