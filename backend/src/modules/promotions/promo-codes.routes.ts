import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../lib/validate.js';
import { redeemPromoCodeSchema } from './promo-codes.schemas.js';
import type { RedeemPromoCodeInput } from './promo-codes.schemas.js';
import * as promoCodesService from './promo-codes.service.js';

export async function promoCodesRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.post(
    '/promo-codes/redeem',
    { preHandler: [authenticate, validateBody(redeemPromoCodeSchema)] },
    async (request) => {
      const body = request.body as RedeemPromoCodeInput;
      return promoCodesService.redeemPromoCode(ctx, request.currentUser!.id, body.code);
    },
  );
}
