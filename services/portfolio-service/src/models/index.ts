import { UserPortfolio } from "./user-portfolio.model";
import { Holding } from "./holding.model";
import { NavSnapshot } from "./nav-snapshot.model";
import { Order } from "./order.model";
import { ProcessedMessage } from "./processed-message.model";
import { SubscribedPortfolio } from "./subscribed-portfolio.model";
import { AutoInvestPlan } from "./auto-invest-plan.model";
import { AutoInvestAllocation } from "./auto-invest-allocation.model";

// Import the shared models
import { 
  ProductType, 
  AssociatedIndexFund, 
  RiskProfileTemplate, 
  QuizQuestion, 
  QuizAnswer 
} from "@auto-invest/shared";

export {
  UserPortfolio,
  ProductType,
  Holding,
  NavSnapshot,
  Order,
  ProcessedMessage,
  AssociatedIndexFund,
  SubscribedPortfolio,
  RiskProfileTemplate,
  QuizQuestion,
  QuizAnswer,
  AutoInvestPlan,
  AutoInvestAllocation,
};

export { RiskProfile, OrderSide, OrderStatus } from "@auto-invest/shared";
