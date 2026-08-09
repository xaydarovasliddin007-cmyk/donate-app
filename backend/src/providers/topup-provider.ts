/**
 * Contract every game top-up/fulfillment provider must implement. The order
 * engine only ever talks to this interface — never to a concrete provider —
 * so a new supplier (or an automatic fallback to a second one) is a new
 * adapter file, not a change to order logic.
 */
export interface TopupProviderAdapter {
  readonly code: string;

  validatePlayer(params: TopupValidatePlayerParams): Promise<TopupValidatePlayerResult>;
  createTopup(params: CreateTopupParams): Promise<CreateTopupResult>;
  getTopupStatus(providerTransactionId: string): Promise<TopupStatusResult>;
}

export interface TopupValidatePlayerParams {
  providerProductCode: string;
  playerId: string;
  serverId?: string;
}

export interface TopupValidatePlayerResult {
  valid: boolean;
  playerName?: string;
  reason?: string;
}

export interface CreateTopupParams {
  providerProductCode: string;
  playerId: string;
  serverId?: string;
  /** Our order ID — passed through so the provider-side transaction can be traced back to us. */
  referenceId: string;
}

export interface CreateTopupResult {
  success: boolean;
  providerTransactionId?: string;
  reason?: string;
  raw?: unknown;
}

export type TopupStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface TopupStatusResult {
  status: TopupStatus;
  raw?: unknown;
}
