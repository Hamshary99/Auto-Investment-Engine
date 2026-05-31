export class QuizService {
  // Implement logic here
}

export class QuizController {
  constructor(private quizService: QuizService) {}

  createQuestion = async (req: any, res: any, next: any) => { res.send("Not implemented"); };
  listQuestions = async (req: any, res: any, next: any) => { res.send("Not implemented"); };
}
