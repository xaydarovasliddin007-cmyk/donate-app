import type {
  CreateTopupParams,
  CreateTopupResult,
  TopupProviderAdapter,
  TopupStatusResult,
  TopupValidatePlayerParams,
  TopupValidatePlayerResult,
} from '../topup-provider.js';

/**
 * Development/test fulfillment provider. No network calls, no real game
 * credit is ever granted — this exists so the order pipeline can be
 * exercised end to end before a real provider contract is signed.
 *
 * QA convenience: a player ID ending in "000" always simulates an
 * invalid-player / fulfillment-failure response, so the failure UI paths
 * are reachable without special test infrastructure.
 */
export class MockTopupProvider implements TopupProviderAdapter {
  readonly code = 'DEV_MOCK_TOPUP';

  async validatePlayer(params: TopupValidatePlayerParams): Promise<TopupValidatePlayerResult> {
    if (params.playerId.endsWith('000')) {
      return { valid: false, reason: 'Player ID not found' };
    }
    return { valid: true, playerName: `Player${params.playerId.slice(-4)}` };
  }

  async createTopup(params: CreateTopupParams): Promise<CreateTopupResult> {
    if (params.playerId.endsWith('000')) {
      return { success: false, reason: 'Player ID not found' };
    }
    return {
      success: true,
      providerTransactionId: `MOCKTOPUP-${params.referenceId.slice(0, 8)}`,
      raw: { simulated: true },
    };
  }

  async getTopupStatus(providerTransactionId: string): Promise<TopupStatusResult> {
    return { status: 'SUCCESS', raw: { providerTransactionId, simulated: true } };
  }
}
