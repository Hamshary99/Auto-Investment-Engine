export const ROUTING_KEYS = {
  ORDER_CREATED: "order.created",
  ORDER_EXECUTED: "order.executed",
  NAV_SNAPSHOT_REQUESTED: "nav.snapshot.requested",
  RECONCILIATION_REQUESTED: "reconciliation.requested",
  ORDER_SWEEP_REQUESTED: "order.sweep.requested",
} as const;

export type RoutingKey = (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS];

export interface EventEnvelope<T> {
  messageId: string;
  occurredAt: string;
  type: RoutingKey;
  payload: T;
}

export interface OrderCreatedPayload {
  orderId: string;
  userId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  priceHint?: number;
}

export interface NavSnapshotRequestedPayload {
  forDate: string; // ISO date
}

export interface ReconciliationRequestedPayload {
  forDate: string;
}

export interface OrderSweepRequestedPayload {
  olderThanSeconds: number;
}
