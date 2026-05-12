export const config = {
  rabbit: {
    url: process.env.RABBITMQ_URL || "amqp://localhost",
    exchange: process.env.RABBITMQ_EXCHANGE || "auto-invest.events",
  },
  cron: {
    navSnapshot: process.env.CRON_NAV_SNAPSHOT || "0 21 * * 1-5",
    reconciliation: process.env.CRON_RECONCILIATION || "0 0 * * *",
    orderSweep: process.env.CRON_ORDER_SWEEP || "*/2 * * * *",
  },
};
