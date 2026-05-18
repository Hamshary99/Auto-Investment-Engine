import "reflect-metadata";
import { AppDataSource } from "../services/portfolio-service/src/data-source";
import {
  AssociatedIndexFund,
  ProductType,
  QuizAnswer,
  QuizQuestion,
  RiskProfileTemplate,
} from "../services/portfolio-service/src/models/index";

type SeedProductType = {
  name: string;
  description: string;
  riskProfile: "conservative" | "moderate" | "aggressive";
  funds: Array<{ symbol: string; targetWeight: number }>;
};

type SeedTemplate = {
  riskProfile: "conservative" | "moderate" | "aggressive";
  allocations: Array<{ productTypeName: string; weight: number }>;
};

type SeedQuestion = {
  text: string;
  displayOrder: number;
  answers: Array<{ text: string; score: number }>;
};

const seedProductTypes: SeedProductType[] = [
  {
    name: "Conservative Income",
    description:
      "Lower-risk portfolio targeting stable income and capital preservation.",
    riskProfile: "conservative",
    funds: [
      { symbol: "BND", targetWeight: 0.6 },
      { symbol: "VTI", targetWeight: 0.3 },
      { symbol: "AGG", targetWeight: 0.1 },
    ],
  },
  {
    name: "Balanced Growth",
    description:
      "Moderate growth portfolio with diversified equity and fixed-income exposure.",
    riskProfile: "moderate",
    funds: [
      { symbol: "VTI", targetWeight: 0.5 },
      { symbol: "QQQ", targetWeight: 0.3 },
      { symbol: "BND", targetWeight: 0.2 },
    ],
  },
  {
    name: "Aggressive Growth",
    description: "Higher-risk growth portfolio with heavier equity exposure.",
    riskProfile: "aggressive",
    funds: [
      { symbol: "QQQ", targetWeight: 0.5 },
      { symbol: "ARKK", targetWeight: 0.3 },
      { symbol: "TSLA", targetWeight: 0.2 },
    ],
  },
];

const seedRiskProfileTemplates: SeedTemplate[] = [
  {
    riskProfile: "conservative",
    allocations: [
      { productTypeName: "Conservative Income", weight: 0.7 },
      { productTypeName: "Balanced Growth", weight: 0.2 },
      { productTypeName: "Aggressive Growth", weight: 0.1 },
    ],
  },
  {
    riskProfile: "moderate",
    allocations: [
      { productTypeName: "Conservative Income", weight: 0.3 },
      { productTypeName: "Balanced Growth", weight: 0.5 },
      { productTypeName: "Aggressive Growth", weight: 0.2 },
    ],
  },
  {
    riskProfile: "aggressive",
    allocations: [
      { productTypeName: "Conservative Income", weight: 0.1 },
      { productTypeName: "Balanced Growth", weight: 0.3 },
      { productTypeName: "Aggressive Growth", weight: 0.6 },
    ],
  },
];

const seedQuizQuestions: SeedQuestion[] = [
  {
    text: "How do you feel about short-term market drops?",
    displayOrder: 1,
    answers: [
      { text: "I prefer safety and minimal losses.", score: 1 },
      { text: "I can tolerate some volatility for growth.", score: 2 },
      { text: "I expect high returns and can accept large swings.", score: 3 },
    ],
  },
  {
    text: "What is your investment horizon?",
    displayOrder: 2,
    answers: [
      { text: "Less than 3 years.", score: 1 },
      { text: "3 to 7 years.", score: 2 },
      { text: "More than 7 years.", score: 3 },
    ],
  },
  {
    text: "How important is capital preservation for you?",
    displayOrder: 3,
    answers: [
      { text: "Very important.", score: 1 },
      { text: "Somewhat important.", score: 2 },
      { text: "Not a priority.", score: 3 },
    ],
  },
  {
    text: "What return profile are you comfortable with?",
    displayOrder: 4,
    answers: [
      { text: "Steady returns with low risk.", score: 1 },
      { text: "Balanced returns and risk.", score: 2 },
      { text: "Maximize growth even if volatile.", score: 3 },
    ],
  },
  {
    text: "If one of your investments drops 20%, what do you do?",
    displayOrder: 5,
    answers: [
      { text: "Sell to avoid further losses.", score: 1 },
      { text: "Hold until it recovers.", score: 2 },
      { text: "Buy more while prices are lower.", score: 3 },
    ],
  },
];

async function seed() {
  await AppDataSource.initialize();

  await AppDataSource.transaction(async (tx) => {
    const productTypeRepo = tx.getRepository(ProductType);
    const indexFundRepo = tx.getRepository(AssociatedIndexFund);
    const templateRepo = tx.getRepository(RiskProfileTemplate);
    const questionRepo = tx.getRepository(QuizQuestion);
    const answerRepo = tx.getRepository(QuizAnswer);

    const productTypes: Record<string, ProductType> = {};

    for (const seedType of seedProductTypes) {
      let productType = await productTypeRepo.findOne({
        where: { name: seedType.name },
      });
      if (!productType) {
        productType = productTypeRepo.create({
          name: seedType.name,
          description: seedType.description,
          riskProfile: seedType.riskProfile,
          isActive: true,
        });
        await productTypeRepo.save(productType);
        console.log(`Created product type: ${seedType.name}`);
      } else {
        console.log(`Skipping existing product type: ${seedType.name}`);
      }

      productTypes[seedType.name] = productType;

      const existingIndexFunds = await indexFundRepo.find({
        where: { productType: { id: productType.id } },
      });
      if (!existingIndexFunds.length) {
        for (const fund of seedType.funds) {
          const indexFund = indexFundRepo.create({
            productType,
            symbol: fund.symbol,
            targetWeight: fund.targetWeight,
          });
          await indexFundRepo.save(indexFund);
        }
      }
    }

    for (const template of seedRiskProfileTemplates) {
      for (const allocation of template.allocations) {
        const productType = productTypes[allocation.productTypeName];
        if (!productType) continue;

        const existing = await templateRepo.findOne({
          where: {
            riskProfile: template.riskProfile,
            productType: { id: productType.id },
          },
        });

        if (!existing) {
          const row = templateRepo.create({
            riskProfile: template.riskProfile,
            productType,
            weight: allocation.weight,
          });
          await templateRepo.save(row);
          console.log(
            `Created template ${template.riskProfile} -> ${allocation.productTypeName}`,
          );
        }
      }
    }

    for (const questionSeed of seedQuizQuestions) {
      let question = await questionRepo.findOne({
        where: { text: questionSeed.text },
      });
      if (!question) {
        question = questionRepo.create({
          text: questionSeed.text,
          displayOrder: questionSeed.displayOrder,
          isActive: true,
        });
        await questionRepo.save(question);
      }

      const existingAnswers = await answerRepo.find({
        where: { question: { id: question.id } },
      });
      if (!existingAnswers.length) {
        for (const answer of questionSeed.answers) {
          const answerRow = answerRepo.create({
            question,
            text: answer.text,
            score: answer.score,
          });
          await answerRepo.save(answerRow);
        }
      }
    }
  });

  console.log("Seed completed successfully.");
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
