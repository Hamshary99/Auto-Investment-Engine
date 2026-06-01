import { QuizService } from "../services/quiz.service";

export class QuizController {
  constructor(private quizService: QuizService) { }

  listQuestions = async (req: any, res: any, next: any) => {
    try {
      const questions = await this.quizService.getQuestions();
      res.json(questions);
    } catch (error) { next(error); }
  };

  listActiveQuestions = async (req: any, res: any, next: any) => {
    try {
      const questions = await this.quizService.getActiveQuestions();
      res.json(questions);
    } catch (error) { next(error); }
  };

  listQuestionAnswers = async (req: any, res: any, next: any) => {
    try {
      const answers = await this.quizService.getAnswersForQuestion(req.params.id);
      res.json(answers);
    } catch (error) { next(error); }
  };

  createQuestion = async (req: any, res: any, next: any) => {
    try {
      const question = await this.quizService.createQuestion(req.body);
      res.status(201).json(question);
    } catch (error) { next(error); }
  };

  createQuestionWithAnswers = async (req: any, res: any, next: any) => {
    try {
      const { question, answers } = req.body;
      const result = await this.quizService.createQuestionWithAnswers(question, answers);
      res.status(201).json(result);
    } catch (error) { next(error); }
  };

  createAnswers = async (req: any, res: any, next: any) => {
    try {
      const answers = await this.quizService.createAnswers(req.body, req.params.id);
      res.status(201).json(answers);
    } catch (error) { next(error); }
  };

  updateQuestion = async (req: any, res: any, next: any) => {
    try {
      const question = await this.quizService.updateQuestion({ ...req.body, id: req.params.id });
      res.json(question);
    } catch (error) { next(error); }
  };

  updateAnswer = async (req: any, res: any, next: any) => {
    try {
      const answer = await this.quizService.updateAnswer({ ...req.body, id: req.params.id });
      res.json(answer);
    } catch (error) { next(error); }
  };

  deleteQuestion = async (req: any, res: any, next: any) => {
    try {
      await this.quizService.deleteQuestion(req.params.id);
      res.json({ message: "Question deleted successfully" });
    } catch (error) { next(error); }
  };

  deleteAnswer = async (req: any, res: any, next: any) => {
    try {
      await this.quizService.deleteAnswer(req.params.id);
      res.json({ message: "Answer deleted successfully" });
    } catch (error) { next(error); }
  };

  inactivateQuestion = async (req: any, res: any, next: any) => {
    try {
      await this.quizService.inactivateQuestion(req.params.id);
      res.json({ message: "Question inactivated successfully" });
    } catch (error) { next(error); }
  };
}
