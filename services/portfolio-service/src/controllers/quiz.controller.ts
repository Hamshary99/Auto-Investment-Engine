import { NextFunction, Response } from "express";
import { AuthedRequest } from "../middleware/auth.middleware";
import { QuizService, QuizSubmissionItem } from "../services/index";

export class QuizController {
    constructor(private readonly quizService: QuizService) {}

    getActiveQuestions = async (req: AuthedRequest, res: Response, next: NextFunction) => {
        try {
            const questions = await this.quizService.getActiveQuestions();
            res.json(questions);
        } catch (err) {
            next(err);
        }
    };

    submitQuiz = async (req: AuthedRequest, res: Response, next: NextFunction) => {
        try {
            const answers = req.body as QuizSubmissionItem[];
            const totalScore = await this.quizService.quizScore(answers);
            const riskProfile = this.quizService.calculateRiskProfile(totalScore, answers.length);
            res.json({ totalScore, riskProfile });
        } catch (err) {
            next(err);
        }
    };
}