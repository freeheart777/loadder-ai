import express from "express";

import { db as defaultDb } from "../../db/workspace-database.mjs";
import { createIdentityRepository } from "../repositories/identity-repository.mjs";
import { createEcommerceService } from "../services/ecommerce-service.mjs";
import { createFinancialLedgerService } from "../commerce/v2/financial-ledger.mjs";
import { createRefundService } from "../commerce/v2/refund-service.mjs";
import { createEcommerceRouter } from "./ecommerce.mjs";

export function createCanonicalCommerceRouter({
  db = defaultDb,
  auditRepository = null,
} = {}) {
  const router = express.Router();
  let commerceRouter = null;

  router.use((req, res, next) => {
    if (!commerceRouter) {
      const financialAuditRepository = auditRepository || createIdentityRepository(db);
      const ecommerceService = createEcommerceService({ db });
      const financialLedgerService = createFinancialLedgerService({
        db,
        auditRepository: financialAuditRepository,
      });
      const refundService = createRefundService({ db });

      commerceRouter = createEcommerceRouter({
        service: ecommerceService,
        financialLedgerService,
        refundService,
      });
    }

    return commerceRouter(req, res, next);
  });

  return router;
}

export default createCanonicalCommerceRouter();
