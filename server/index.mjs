import express from "express";
import cors from "cors";
import crypto from "crypto";

import { environment } from "./app/config/environment.mjs";
import { createProductPolicy } from "./app/product-policy.mjs";
import {
  assertLegacyOperationEnabled,
  createApiProductGate,
  createInternalAccessMiddleware,
  createProductionOriginGuard,
} from "./app/middleware/product-gating.mjs";
import { createAiRouter } from "./app/routes/ai.mjs";
import { createAiEconomyRouter } from "./app/routes/ai-economy.mjs";
import { createGrowthWorkflowRouter } from "./app/routes/growth-workflow.mjs";
import { createImprovementCycleRouter } from "./app/routes/improvement-cycles.mjs";
import { createSystemConstraintRouter } from "./app/routes/system-constraint-core.mjs";
import { createInternalTqmRouter } from "./app/routes/internal-tqm.mjs";
import { createInternalTqmPdcaRouter } from "./app/routes/internal-tqm-pdca.mjs";
import { createInternalQualitySource } from "./app/internal-quality/internal-quality-source.mjs";
import { createAiOperationRegistry } from "./app/ai/ai-operation-registry.mjs";
import { createOpenAiResponsesProvider } from "./app/ai/providers/openai-responses-provider.mjs";
import { createAiEconomyService } from "./app/ai/economy/ai-economy-service.mjs";
import { createAiEconomyMetrics } from "./app/ai/economy/ai-economy-metrics.mjs";
import { createAiBudgetGovernor } from "./app/ai/economy/budget-governor.mjs";
import { deterministicCapabilityRegistry } from "./app/ai/economy/deterministic-capability-registry.mjs";
import { growthPatternRegistry, learnedIntelligencePolicy } from "./app/ai/economy/pattern-registry.mjs";
import { persianAiBenchmarkRegistry } from "./app/ai/benchmarks/persian-benchmark-registry.mjs";
import { createBusinessBrainRateLimiter } from "./app/business-brain/business-brain-rate-limiter.mjs";
import { createBusinessBrainService } from "./app/business-brain/business-brain-service.mjs";
import { createAuthRouter } from "./app/routes/auth.mjs";
import { createWorkspaceRouter } from "./app/routes/workspaces.mjs";
import { createBusinessProfileRouter } from "./app/routes/business-profile.mjs";
import { createBusinessDnaRouter } from "./app/routes/business-dna.mjs";
import { createBrandBookRouter } from "./app/routes/brand-book.mjs";
import { createBusinessContextRouter } from "./app/routes/business-context.mjs";
import { createOnboardingRouter } from "./app/routes/onboarding.mjs";
import { createTextAiContextRouter } from "./app/routes/text-ai-context.mjs";
import { createIntelligenceDataRouter } from "./app/routes/intelligence-data.mjs";
import { createFeatureValueRouter } from "./app/routes/feature-values.mjs";
import { createModelEvaluationRouter } from "./app/routes/model-evaluations.mjs";
import { createForecastRouter } from "./app/routes/forecasts.mjs";
import { createIntegrationRouter } from "./app/routes/integrations.mjs";
import { createKnowledgeKpiRouter } from "./app/routes/knowledge-kpis.mjs";
import { createKnowledgeExtractionRouter } from "./app/routes/knowledge-extraction.mjs";
import { createImportedFactMappingRouter } from "./app/routes/imported-fact-mapping.mjs";
import { createListeningRouter } from "./app/routes/listening.mjs";
import { createListeningIntelligenceRouter } from "./app/routes/listening-intelligence.mjs";
import { createSemanticIntelligenceRouter } from "./app/routes/semantic-intelligence.mjs";
import { createRecommendationIntelligenceRouter } from "./app/routes/recommendation-intelligence.mjs";
import { createHumanGovernanceRouter } from "./app/routes/human-governance.mjs";
import { createActionProposalRouter } from "./app/routes/action-proposals.mjs";
import { createExecutionAuthorizationRouter } from "./app/routes/execution-authorizations.mjs";
import { createExecutionRequestRouter } from "./app/routes/execution-requests.mjs";
import { createProviderAccountIdentityRouter } from "./app/routes/provider-account-identities.mjs";
import { createExecutionLedgerRouter } from "./app/routes/execution-ledger.mjs";
import { createContentGenerationRouter } from "./app/routes/content-generation.mjs";
import { createContentItemRouter } from "./app/routes/content-items.mjs";
import { createContentAssetRouter } from "./app/routes/content-assets.mjs";
import { createCreativePlacementRouter } from "./app/routes/creative-placements.mjs";
import { createCreativeIntentRouter } from "./app/routes/creative-intents.mjs";
import { createDistributionContextRouter } from "./app/routes/distribution-contexts.mjs";
import { createAttributionTouchRouter } from "./app/routes/attribution-touches.mjs";
import { createPerformanceObservationRouter } from "./app/routes/performance-observations.mjs";
import { createLandingRouter } from "./app/routes/landings.mjs";
import { createLandingCommercializationRouter, createLandingPublicRouter } from "./app/routes/landing-commercialization.mjs";
import { createWebsiteRouter } from "./app/routes/websites.mjs";
import { createCommerceCatalogRouter } from "./app/routes/commerce-catalogs.mjs";
import { createMarketplaceCommerceRouter, createMarketplacePublicRouter } from "./app/routes/marketplace-commerce.mjs";
import { createDomainPublishingRouter, createPublicHostRouter } from "./app/routes/domain-publishing.mjs";
import { createPublicFormsRouter, createSecureFormsCrmRouter } from "./app/routes/secure-forms-crm.mjs";
import { createCartCheckoutRouter } from "./app/routes/cart-checkout.mjs";
import { createPaymentOrderRouter } from "./app/routes/payment-orders.mjs";
import { createInventoryFulfillmentRouter } from "./app/routes/inventory-fulfillment.mjs";
import { createReturnPublicRouter, createReturnRefundRouter } from "./app/routes/return-refunds.mjs";
import { createLegacyCrmRouter } from "./app/routes/legacy-crm.mjs";
import { createLegacyAutomationsRouter } from "./app/routes/legacy-automations.mjs";
import { createLegacyMarketingRouter } from "./app/routes/legacy-marketing.mjs";
import { createLegacyCampaignsRouter } from "./app/routes/legacy-campaigns.mjs";
import { createLegacyAttributionRouter } from "./app/routes/legacy-attribution.mjs";
import { createIdentityRepository } from "./app/repositories/identity-repository.mjs";
import { createBusinessProfileRepository } from "./app/repositories/business-profile-repository.mjs";
import { createBusinessDnaRepository } from "./app/repositories/business-dna-repository.mjs";
import { createBrandBookRepository } from "./app/repositories/brand-book-repository.mjs";
import { createBusinessContextRepository } from "./app/repositories/business-context-repository.mjs";
import { createGrowthWorkflowRepository } from "./app/repositories/growth-workflow-repository.mjs";
import { createImprovementCycleRepository } from "./app/repositories/improvement-cycle-repository.mjs";
import { createSystemConstraintRepository } from "./app/repositories/system-constraint-repository.mjs";
import { createBusinessContextUsageRepository } from "./app/repositories/business-context-usage-repository.mjs";
import { createBusinessEventRepository } from "./app/repositories/business-event-repository.mjs";
import { createIntelligenceRecordRepository } from "./app/repositories/intelligence-record-repository.mjs";
import { createFeatureValueRepository } from "./app/repositories/feature-value-repository.mjs";
import { createModelInputRepository } from "./app/repositories/model-input-repository.mjs";
import { createEvaluationRepository } from "./app/repositories/evaluation-repository.mjs";
import { createForecastRepository } from "./app/repositories/forecast-repository.mjs";
import { createIntegrationRepository } from "./app/repositories/integration-repository.mjs";
import { createKnowledgeKpiRepository } from "./app/repositories/knowledge-kpi-repository.mjs";
import { createKnowledgeExtractionRepository } from "./app/repositories/knowledge-extraction-repository.mjs";
import { createImportedFactEventLinkRepository } from "./app/repositories/imported-fact-event-link-repository.mjs";
import { createListeningRepository } from "./app/repositories/listening-repository.mjs";
import { createListeningIntelligenceRepository } from "./app/repositories/listening-intelligence-repository.mjs";
import { createSemanticFindingRepository } from "./app/repositories/semantic-finding-repository.mjs";
import { createIntelligenceRecommendationRepository } from "./app/repositories/intelligence-recommendation-repository.mjs";
import { createHumanGovernanceRepository } from "./app/repositories/human-governance-repository.mjs";
import { createActionProposalRepository } from "./app/repositories/action-proposal-repository.mjs";
import { createExecutionAuthorizationRepository } from "./app/repositories/execution-authorization-repository.mjs";
import { createExecutionRequestRepository } from "./app/repositories/execution-request-repository.mjs";
import { createProviderAccountIdentityRepository } from "./app/repositories/provider-account-identity-repository.mjs";
import { createExecutionLedgerRepository } from "./app/repositories/execution-ledger-repository.mjs";
import { createExecutionDispatchJobRepository } from "./app/repositories/execution-dispatch-job-repository.mjs";
import { createContentGenerationRepository } from "./app/repositories/content-generation-repository.mjs";
import { createSecureFormsCrmRepository } from "./app/repositories/secure-forms-crm-repository.mjs";
import { createContentItemRepository } from "./app/repositories/content-item-repository.mjs";
import { createContentAssetRepository } from "./app/repositories/content-asset-repository.mjs";
import { createCreativePlacementRepository } from "./app/repositories/creative-placement-repository.mjs";
import { createCreativeIntentRepository } from "./app/repositories/creative-intent-repository.mjs";
import { createDistributionContextRepository } from "./app/repositories/distribution-context-repository.mjs";
import { createAttributionTouchRepository } from "./app/repositories/attribution-touch-repository.mjs";
import { createPerformanceObservationRepository } from "./app/repositories/performance-observation-repository.mjs";
import { createLandingRepository } from "./app/repositories/landing-repository.mjs";
import { createWebsiteRepository } from "./app/repositories/website-repository.mjs";
import { createCommerceCatalogRepository } from "./app/repositories/commerce-catalog-repository.mjs";
import { createMarketplaceCommerceRepository } from "./app/repositories/marketplace-commerce-repository.mjs";
import { createDomainPublishingRepository } from "./app/repositories/domain-publishing-repository.mjs";
import { createCartCheckoutRepository } from "./app/repositories/cart-checkout-repository.mjs";
import { createPaymentOrderRepository } from "./app/repositories/payment-order-repository.mjs";
import { createInventoryFulfillmentRepository } from "./app/repositories/inventory-fulfillment-repository.mjs";
import { createReturnRefundRepository } from "./app/repositories/return-refund-repository.mjs";
import { createAuthService } from "./app/services/auth-service.mjs";
import { createBusinessProfileService } from "./app/services/business-profile-service.mjs";
import { createBusinessDnaService } from "./app/services/business-dna-service.mjs";
import { createBrandBookService } from "./app/services/brand-book-service.mjs";
import { createBusinessContextService } from "./app/services/business-context-service.mjs";
import { createGrowthWorkflowService } from "./app/services/growth-workflow-service.mjs";
import { createImprovementCycleService } from "./app/services/improvement-cycle-service.mjs";
import { createSystemConstraintService } from "./app/services/system-constraint-service.mjs";
import { createGovernedInternalTqmService } from "./app/services/internal-tqm-pdca-service.mjs";
import { createGrowthRateLimiter } from "./app/growth/growth-rate-limiter.mjs";
import { createOnboardingService } from "./app/services/onboarding-service.mjs";
import { createOperationMetrics } from "./app/observability/operation-metrics.mjs";
import { createContentGenerationService } from "./app/services/content-generation-service.mjs";
import { createContentItemService } from "./app/services/content-item-service.mjs";
import { createContentAssetService } from "./app/services/content-asset-service.mjs";
import { createCreativePlacementService } from "./app/services/creative-placement-service.mjs";
import { createCreativeIntentService } from "./app/services/creative-intent-service.mjs";
import { createDistributionContextService } from "./app/services/distribution-context-service.mjs";
import { createAttributionTouchService } from "./app/services/attribution-touch-service.mjs";
import { createPerformanceObservationService } from "./app/services/performance-observation-service.mjs";
import { createLandingService } from "./app/services/landing-service.mjs";
import { createLandingCommercializationService } from "./app/services/landing-commercialization-service.mjs";
import { createWebsiteService } from "./app/services/website-service.mjs";
import { storefrontComponentRegistry } from "./app/commerce/storefront-component-registry.mjs";
import { createCommerceCatalogService } from "./app/services/commerce-catalog-service.mjs";
import { createMarketplaceCommerceService } from "./app/services/marketplace-commerce-service.mjs";
import { createCommerceBulkService } from "./app/services/commerce-bulk-service.mjs";
import { createIntegrationHubService } from "./app/services/integration-hub-service.mjs";
import { createDomainPublishingService } from "./app/services/domain-publishing-service.mjs";
import { createSystemDnsVerifier, createUnavailableTlsProvider } from "./app/publishing/domain-providers.mjs";
import { createPublicStaticProvider, createUnavailablePublicMediaProvider } from "./app/publishing/public-static-provider.mjs";
import { marketplaceProviderRegistry } from "./app/marketplaces/marketplace-provider-registry.mjs";
import { createCartCheckoutService } from "./app/services/cart-checkout-service.mjs";
import { commerceShippingRegistry } from "./app/commerce/commerce-shipping-registry.mjs";
import { createUnavailablePaymentProvider } from "./app/payments/payment-providers.mjs";
import { paymentProviderRegistry } from "./app/payments/payment-provider-registry.mjs";
import { createPaymentOrderService } from "./app/services/payment-order-service.mjs";
import { createInventoryFulfillmentService } from "./app/services/inventory-fulfillment-service.mjs";
import { createTipaxShippingProvider } from "./app/shipping/tipax-shipping-provider.mjs";
import { shippingProviderRegistry } from "./app/shipping/shipping-provider-registry.mjs";
import { createReturnRefundService } from "./app/services/return-refund-service.mjs";
import { createUnavailableRefundProvider } from "./app/refunds/refund-providers.mjs";
import { returnReasonRegistry } from "./app/returns/return-reason-registry.mjs";
import { landingComponentRegistry } from "./app/landing/landing-component-registry.mjs";
import { createGovernedExperiencePublisher } from "./app/forms/governed-experience-publisher.mjs";
import { createLandingTrackingTokenService } from "./app/landing/landing-tracking-token.mjs";
import { createSecureFormsCrmService } from "./app/services/secure-forms-crm-service.mjs";
import { createLandingPublicRateLimiter } from "./app/landing/landing-public-rate-limiter.mjs";
import { websitePresetRegistry } from "./app/website/website-preset-registry.mjs";
import { createWebsitePublisher } from "./app/website/website-publisher.mjs";
import { storeArchetypeRegistry } from "./app/commerce/store-archetype-registry.mjs";
import { createUnavailableContentAssetStore } from "./app/content-assets/content-asset-store.mjs";
import { createR2ContentAssetStore } from "./app/content-assets/r2-content-asset-store.mjs";
import { createContentGenerationRateLimiter } from "./app/content-generation/content-generation-rate-limiter.mjs";
import { channelRegistry } from "./app/distribution/channel-registry.mjs";
import { observationContractRegistry } from "./app/performance/observation-contract-registry.mjs";
import { generationContractRegistry } from "./app/content-generation/contract-registry.mjs";
import { contentPlacementRegistry } from "./app/content-generation/placement-registry.mjs";
import { textProviderBindingRegistry } from "./app/content-generation/provider-binding-registry.mjs";
import { createOpenAITextGenerationProvider } from "./app/content-generation/openai-text-provider.mjs";
import { contextCapabilityRegistry } from "./app/context-consumers/capability-registry.mjs";
import { createBusinessContextConsumerGateway } from "./app/context-consumers/business-context-consumer-gateway.mjs";
import { createTextAiContextConsumer } from "./app/context-consumers/text-ai-consumer.mjs";
import { eventTypeRegistry } from "./app/events/event-type-registry.mjs";
import { createCartAbandonmentSignalProducer } from "./app/signal-producers/cart-abandonment-signal-producer.mjs";
import { createListeningFactualSignalProducer } from "./app/signal-producers/listening-factual-signal-producer.mjs";
import { createCompositeSignalProducer } from "./app/signal-producers/composite-signal-producer.mjs";
import { createBusinessEventService } from "./app/services/business-event-service.mjs";
import { createIntelligenceQueryService } from "./app/services/intelligence-query-service.mjs";
import { createFeatureQueryService } from "./app/services/feature-query-service.mjs";
import { featureRegistry } from "./app/features/feature-registry.mjs";
import { createCartFeatureProducer } from "./app/feature-producers/cart-feature-producer.mjs";
import { modelSpecificationRegistry } from "./app/model-specifications/model-specification-registry.mjs";
import { createDeterministicModelInputBuilder } from "./app/model-input-builders/deterministic-model-input-builder.mjs";
import { createModelEvaluationService } from "./app/services/model-evaluation-service.mjs";
import { forecastSpecificationRegistry } from "./app/forecasts/forecast-specification-registry.mjs";
import { createForecastService } from "./app/services/forecast-service.mjs";
import { connectorRegistry } from "./app/integrations/connector-registry.mjs";
import { createIntegrationService } from "./app/services/integration-service.mjs";
import { createKnowledgeKpiService } from "./app/services/knowledge-kpi-service.mjs";
import { parserRegistry } from "./app/knowledge-parsers/parser-registry.mjs";
import { parseDeterministically } from "./app/knowledge-parsers/deterministic-parsers.mjs";
import { createKnowledgeExtractionService } from "./app/services/knowledge-extraction-service.mjs";
import { importedFactMapperRegistry } from "./app/import-mappers/imported-fact-mapper-registry.mjs";
import { createImportedFactEventMapperService } from "./app/services/imported-fact-event-mapper-service.mjs";
import { listeningSourceRegistry } from "./app/listening/listening-source-registry.mjs";
import { listeningEventMapperRegistry } from "./app/listening/listening-event-mapper-registry.mjs";
import { createListeningService } from "./app/services/listening-service.mjs";
import { createListeningEventMapperService } from "./app/services/listening-event-mapper-service.mjs";
import { createListeningIntelligenceService } from "./app/services/listening-intelligence-service.mjs";
import { createSemanticIntelligenceService } from "./app/services/semantic-intelligence-service.mjs";
import { semanticContractRegistry } from "./app/semantic/semantic-contract-registry.mjs";
import { createRecommendationIntelligenceService } from "./app/services/recommendation-intelligence-service.mjs";
import { createHumanGovernanceService } from "./app/services/human-governance-service.mjs";
import { createActionProposalService } from "./app/services/action-proposal-service.mjs";
import { createExecutionAuthorizationService } from "./app/services/execution-authorization-service.mjs";
import { createExecutionRequestService } from "./app/services/execution-request-service.mjs";
import { createProviderAccountIdentityService } from "./app/services/provider-account-identity-service.mjs";
import { createExecutionLedgerService } from "./app/services/execution-ledger-service.mjs";
import { createExecutionDispatchJobService } from "./app/services/execution-dispatch-job-service.mjs";
import { createRecommendationFreshnessQuery } from "./app/recommendations/recommendation-freshness-query.mjs";
import { actionProposalContractRegistry } from "./app/action-proposals/action-proposal-contract-registry.mjs";
import { authorizationPolicyRegistry } from "./app/execution-authorizations/authorization-policy-registry.mjs";
import { executionRequestPolicyRegistry } from "./app/execution-requests/request-policy-registry.mjs";
import { providerIdentityVerifierRegistry } from "./app/provider-account-identities/verifier-registry.mjs";
import { executionCapabilityRegistry } from "./app/execution-capabilities/capability-registry.mjs";
import { attemptPolicyRegistry } from "./app/execution-capabilities/attempt-policy-registry.mjs";
import { recommendationContractRegistry } from "./app/recommendations/recommendation-contract-registry.mjs";
import {
  createRequireAuth,
  createRequireWorkspace,
} from "./app/middleware/auth.mjs";
import { runMigrations } from "./db/migrate.mjs";
import {
  requireWorkspaceId,
  runWithWorkspace,
} from "./app/tenant-context.mjs";
import { createWorkspaceRuntimeStore } from "./app/services/workspace-runtime-store.mjs";

import {
  sendMessage as sendLegacyMessage,
  getMessagingStatus,
} from "./services/messaging.mjs";

import {
  /* =========================
     OPTIMIZER
  ========================= */

  CONTROL_MODES,
  planCampaign,
  buildCampaignScenarios,
  optimizeCampaign,
  simulateOptimization,
  buildDefaultGuardrails,
  getControlModeDefinition,
  suggestBudgetReallocation,
  getOptimizerCapabilities,
} from "./services/optimizer.mjs";

import {
  db,
  /* =========================
     AUTOMATION
  ========================= */

  getAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  saveEvent,
  saveExecution,
  getExecutions,
  clearExecutions,
  seedDefaultAutomations,

  /* =========================
     CRM
  ========================= */

  getCustomers,
  getCustomerById,
  createCustomer,
  getCustomer360,

  getLeads,
  getLeadById,
  createLead,
  updateLead,
  convertLeadToCustomer,
  transferLeadAttributionToCustomer,

  getOrders,
  createOrder,

  getCarts,
  createCart,

  getCustomerEvents,
  createCustomerEvent,

  getCRMStats,
  seedCRMData,

  /* =========================
     MARKETING
  ========================= */

  getMarketingChannels,
  getMarketingPlatforms,
  getAdvertisingServices,

  getMarketingCampaigns,
  getCampaignById,

  getCampaignMetrics,
  calculateCampaignKPIs,

  createMarketingCampaign,
  saveCampaignMetric,

  getAttributionTouchpoints,
  createAttributionTouchpoint,

  attributeOrderToCustomerCampaign,
  getCampaignAttributedPerformance,

  seedMarketingData,
} from "./db/workspace-database.mjs";

const app = express();
const productPolicy = createProductPolicy({
  nodeEnv: environment.nodeEnv,
  overrides: environment.productFeatureOverrides,
});
const landingPublicOrigin = (() => { try { return new URL(environment.landing.publicBaseUrl).origin; } catch { return ""; } })();

app.use(
  cors((request, callback) => {
    callback(null, {
      origin(origin, originCallback) {
        if (
          !origin ||
          environment.clientOrigins.includes(origin) ||
          origin === landingPublicOrigin ||
          request.path.startsWith("/api/public/forms/")
        ) {
          return originCallback(null, true);
        }

        return originCallback(new Error("Origin is not allowed by CORS."));
      },
      credentials: !request.path.startsWith("/api/public/forms/"),
    });
  })
);
app.use("/api/public/landing/events", express.json({ limit: "8kb" }));
app.use("/api/public/forms", express.json({ limit: "40kb" }));
app.use(
  express.json({
    limit: "2mb",
  })
);
app.use(createProductionOriginGuard({
  nodeEnv: environment.nodeEnv,
  clientOrigins: environment.clientOrigins,
}));

const PORT = environment.apiPort;

const appliedMigrations = runMigrations(db);
const identityRepository = createIdentityRepository(db);
const businessProfileRepository = createBusinessProfileRepository(db);
const businessDnaRepository = createBusinessDnaRepository(db);
const brandBookRepository = createBrandBookRepository(db);
const businessContextRepository = createBusinessContextRepository(db);
const growthWorkflowRepository = createGrowthWorkflowRepository(db);
const improvementCycleRepository = createImprovementCycleRepository(db);
const systemConstraintRepository = createSystemConstraintRepository(db);
const businessContextUsageRepository = createBusinessContextUsageRepository(db);
const contentGenerationRepository = createContentGenerationRepository(db);
const contentItemRepository = createContentItemRepository(db);
const contentAssetRepository = createContentAssetRepository(db);
const creativePlacementRepository = createCreativePlacementRepository(db);
const creativeIntentRepository = createCreativeIntentRepository(db);
const distributionContextRepository = createDistributionContextRepository(db);
const attributionTouchRepository = createAttributionTouchRepository(db);
const performanceObservationRepository = createPerformanceObservationRepository(db);
const landingRepository = createLandingRepository(db);
const websiteRepository = createWebsiteRepository(db);
const commerceCatalogRepository = createCommerceCatalogRepository(db);
const marketplaceCommerceRepository = createMarketplaceCommerceRepository(db);
const domainPublishingRepository = createDomainPublishingRepository(db);
const secureFormsCrmRepository = createSecureFormsCrmRepository(db);
const cartCheckoutRepository = createCartCheckoutRepository(db);
const paymentOrderRepository = createPaymentOrderRepository(db);
const inventoryFulfillmentRepository = createInventoryFulfillmentRepository(db);
const returnRefundRepository = createReturnRefundRepository(db);
const businessEventRepository = createBusinessEventRepository(db);
const intelligenceRecordRepository = createIntelligenceRecordRepository(db);
const featureValueRepository = createFeatureValueRepository(db);
const modelInputRepository = createModelInputRepository(db);
const evaluationRepository = createEvaluationRepository(db);
const forecastRepository = createForecastRepository(db);
const integrationRepository = createIntegrationRepository(db);
const knowledgeKpiRepository = createKnowledgeKpiRepository(db);
const knowledgeExtractionRepository = createKnowledgeExtractionRepository(db);
const importedFactEventLinkRepository = createImportedFactEventLinkRepository(db);
const listeningRepository = createListeningRepository(db);
const listeningIntelligenceRepository = createListeningIntelligenceRepository(db);
const semanticFindingRepository = createSemanticFindingRepository(db);
const intelligenceRecommendationRepository = createIntelligenceRecommendationRepository(db);
const authService = createAuthService({
  repository: identityRepository,
  otpHashSecret: environment.authHashSecret,
});
const businessProfileService = createBusinessProfileService({
  repository: businessProfileRepository,
  auditRepository: identityRepository,
});
const businessDnaService = createBusinessDnaService({
  repository: businessDnaRepository,
  auditRepository: identityRepository,
});
const brandBookService = createBrandBookService({
  repository: brandBookRepository,
  auditRepository: identityRepository,
});
const businessContextService = createBusinessContextService({
  repository: businessContextRepository,
  auditRepository: identityRepository,
});
const onboardingService = createOnboardingService({
  businessProfileService,
  businessDnaService,
  brandBookService,
  businessContextService,
  operationMetrics: createOperationMetrics(),
});
const businessContextConsumerGateway = createBusinessContextConsumerGateway({
  businessContextService,
  usageRepository: businessContextUsageRepository,
  capabilityRegistry: contextCapabilityRegistry,
});
const textAiContextConsumer = createTextAiContextConsumer({
  contextGateway: businessContextConsumerGateway,
});
const aiOperationPolicyRegistry = createAiOperationRegistry();
const openAiResponsesProvider = createOpenAiResponsesProvider();
const aiBudgetGovernor = createAiBudgetGovernor();
const aiEconomyService = createAiEconomyService({ provider: openAiResponsesProvider, policyRegistry: aiOperationPolicyRegistry, deterministicRegistry: deterministicCapabilityRegistry, metrics: createAiEconomyMetrics(), budgetGovernor: aiBudgetGovernor });
const internalQualitySource = createInternalQualitySource({ economyService: aiEconomyService, benchmarkRegistry: persianAiBenchmarkRegistry, databaseStatus: () => { const pages = db.pragma("page_count", { simple: true }), pageSize = db.pragma("page_size", { simple: true }); return { bytes: pages * pageSize, pages, pageSize }; } });
const businessBrainService = createBusinessBrainService({ provider: openAiResponsesProvider, economyService: aiEconomyService, policyRegistry: aiOperationPolicyRegistry, rateLimiter: createBusinessBrainRateLimiter(), operationMetrics: createOperationMetrics() });
const contentGenerationService = createContentGenerationService({
  repository: contentGenerationRepository,
  intentRepository: creativeIntentRepository,
  contractRegistry: generationContractRegistry,
  placementRegistry: contentPlacementRegistry,
  providerBindingRegistry: textProviderBindingRegistry,
  contextGateway: businessContextConsumerGateway,
  provider: createOpenAITextGenerationProvider({ responsesProvider: openAiResponsesProvider, economyService: aiEconomyService }),
  rateLimiter: createContentGenerationRateLimiter(),
  operationMetrics: createOperationMetrics(),
});
const contentItemService = createContentItemService({
  repository: contentItemRepository,
  generationRepository: contentGenerationRepository,
  assetRepository: contentAssetRepository,
  contractRegistry: generationContractRegistry,
  placementRegistry: contentPlacementRegistry,
  operationMetrics: createOperationMetrics(),
});
const contentAssetStore = environment.contentAssetStorage.provider === "r2" ? (createR2ContentAssetStore(environment.contentAssetStorage) || createUnavailableContentAssetStore()) : createUnavailableContentAssetStore();
const contentAssetService = createContentAssetService({ repository: contentAssetRepository, store: contentAssetStore, operationMetrics: createOperationMetrics() });
const creativePlacementService = createCreativePlacementService({ repository: creativePlacementRepository, contentItemRepository, operationMetrics: createOperationMetrics() });
const creativeIntentService = createCreativeIntentService({ repository: creativeIntentRepository, operationMetrics: createOperationMetrics() });
const distributionContextService = createDistributionContextService({ repository: distributionContextRepository, placementRepository: creativePlacementRepository, registry: channelRegistry, operationMetrics: createOperationMetrics() });
const attributionTouchService = createAttributionTouchService({ repository: attributionTouchRepository, distributionContextRepository, operationMetrics: createOperationMetrics() });
const performanceObservationService = createPerformanceObservationService({ repository: performanceObservationRepository, distributionContextRepository, attributionTouchRepository, registry: observationContractRegistry, operationMetrics: createOperationMetrics() });
const baseExperiencePublisher = createGovernedExperiencePublisher({ nodeEnv: environment.nodeEnv, staticDirectory: environment.landing.staticDirectory, publicBaseUrl: environment.landing.publicBaseUrl, publicApiBaseUrl: environment.landing.publicApiBaseUrl });
const landingPublisher = Object.freeze({ ...baseExperiencePublisher, publishRegisteredBlueprint(input) { for (const section of input.blueprint.blueprint.sections) { if (section.componentId !== "FORM_OR_ACTION" || section.variant !== "FORM_DEFINITION") continue; const form = secureFormsCrmRepository.publicForm(section.props?.publicFormReference); if (!form || form.workspaceId !== input.project.workspaceId || form.revision !== section.props?.formRevision) return Object.freeze({ available: false, failureCode: "GOVERNED_FORM_UNAVAILABLE" }); } return baseExperiencePublisher.publishRegisteredBlueprint(input); } });
const landingTrackingTokenService = createLandingTrackingTokenService({ secret: environment.landing.trackingSecret, ttlSeconds: environment.landing.trackingTtlSeconds });
const secureFormsCrmService = createSecureFormsCrmService({ repository: secureFormsCrmRepository, trackingTokenService: landingTrackingTokenService });
const landingService = createLandingService({ repository: landingRepository, intentRepository: creativeIntentRepository, contextRepository: businessContextRepository, placementRepository: creativePlacementRepository, assetRepository: contentAssetRepository, componentRegistry: landingComponentRegistry, publisher: landingPublisher, operationMetrics: createOperationMetrics() });
const landingCommercializationService = createLandingCommercializationService({ landingRepository, distributionContextRepository, touchRepository: attributionTouchRepository, observationRepository: performanceObservationRepository, tokenService: landingTrackingTokenService, publisher: landingPublisher, atomic: (work) => db.transaction(work)() });
const websiteService = createWebsiteService({ repository: websiteRepository, contextRepository: businessContextRepository, placementRepository: creativePlacementRepository, assetRepository: contentAssetRepository, catalogRepository: commerceCatalogRepository, componentRegistry: storefrontComponentRegistry, presetRegistry: websitePresetRegistry, publisher: createWebsitePublisher({ landingPublisher }) });
const growthWorkflowService = createGrowthWorkflowService({ repository: growthWorkflowRepository, contextRepository: businessContextRepository, provider: openAiResponsesProvider, economyService: aiEconomyService, policyRegistry: aiOperationPolicyRegistry, rateLimiter: createGrowthRateLimiter(), landingService, websiteService, contentGenerationService });
const improvementCycleService = createImprovementCycleService({ repository: improvementCycleRepository });
const internalTqmService = createGovernedInternalTqmService({ source: internalQualitySource, pdcaService: improvementCycleService });
const systemConstraintService = createSystemConstraintService({ repository: systemConstraintRepository });
const commerceCatalogService = createCommerceCatalogService({ repository: commerceCatalogRepository, assetRepository: contentAssetRepository, archetypeRegistry: storeArchetypeRegistry });
const marketplaceCommerceService = createMarketplaceCommerceService({ repository: marketplaceCommerceRepository, registry: marketplaceProviderRegistry, publicUrlResolver: (catalog, product) => domainPublishingRepository.productUrl(catalog.id, product.id), assetUrlResolver: (assetId) => domainPublishingRepository.publicAssetUrl(assetId) });
const cartCheckoutService = createCartCheckoutService({ repository: cartCheckoutRepository, shippingRegistry: commerceShippingRegistry });
const inventoryFulfillmentService = createInventoryFulfillmentService({ repository: inventoryFulfillmentRepository, provider: createTipaxShippingProvider(), now: () => new Date() });
const commerceBulkService = createCommerceBulkService({ repository: marketplaceCommerceRepository, catalogService: commerceCatalogService, inventoryService: inventoryFulfillmentService });
const paymentOrderService = createPaymentOrderService({ repository: paymentOrderRepository, provider: createUnavailablePaymentProvider(), callbackBaseUrl: environment.clientOrigins[0] || "http://127.0.0.1", postPaymentProcessor: inventoryFulfillmentService, now: () => new Date() });
const integrationHubService = createIntegrationHubService({ marketplaceRegistry: marketplaceProviderRegistry, paymentRegistry: paymentProviderRegistry, shippingRegistry: shippingProviderRegistry, paymentReadiness: () => paymentOrderService.readiness(), shippingReadiness: () => inventoryFulfillmentService.readiness() });
const publicStaticProvider = createPublicStaticProvider({ nodeEnv: environment.nodeEnv, staticDirectory: environment.publishing.staticDirectory, publicBaseUrl: environment.publishing.publicBaseUrl });
const domainPublishingService = createDomainPublishingService({ repository: domainPublishingRepository, dnsVerifier: createSystemDnsVerifier(), tlsProvider: createUnavailableTlsProvider(), staticProvider: publicStaticProvider, mediaProvider: createUnavailablePublicMediaProvider(), artifactResolver: (page) => landingPublisher.resolvePublication({ publication: { path: page.artifactPath, artifactChecksum: page.artifactChecksum }, blueprint: page.blueprint }) });
const returnRefundService = createReturnRefundService({ repository: returnRefundRepository, provider: createUnavailableRefundProvider(), reasonRegistry: returnReasonRegistry, now: () => new Date() });
const cartFeatureProducer = createCartFeatureProducer({
  contextGateway: businessContextConsumerGateway,
  featureRegistry,
  repository: featureValueRepository,
});
const cartAbandonmentSignalProducer = createCartAbandonmentSignalProducer({
  contextGateway: businessContextConsumerGateway,
  repository: intelligenceRecordRepository,
  featureProducer: cartFeatureProducer,
});
const listeningFactualSignalProducer = createListeningFactualSignalProducer({
  contextGateway: businessContextConsumerGateway,
  repository: intelligenceRecordRepository,
});
const compositeSignalProducer = createCompositeSignalProducer([
  cartAbandonmentSignalProducer,
  listeningFactualSignalProducer,
]);
const businessEventService = createBusinessEventService({
  repository: businessEventRepository,
  eventRegistry: eventTypeRegistry,
  contextGateway: businessContextConsumerGateway,
  signalProducer: compositeSignalProducer,
});
const intelligenceQueryService = createIntelligenceQueryService({
  repository: intelligenceRecordRepository,
});
const featureQueryService = createFeatureQueryService({
  repository: featureValueRepository,
});
const modelInputBuilder = createDeterministicModelInputBuilder({
  contextGateway: businessContextConsumerGateway,
  featureRepository: featureValueRepository,
  specificationRegistry: modelSpecificationRegistry,
});
const modelEvaluationService = createModelEvaluationService({
  specificationRegistry: modelSpecificationRegistry,
  modelInputRepository,
  evaluationRepository,
  modelInputBuilder,
});
const forecastService = createForecastService({ registry: forecastSpecificationRegistry, modelInputRepository, repository: forecastRepository });
const integrationService = createIntegrationService({ registry: connectorRegistry, repository: integrationRepository, auditRepository: identityRepository });
const knowledgeKpiService = createKnowledgeKpiService({ repository: knowledgeKpiRepository, auditRepository: identityRepository });
const knowledgeExtractionService = createKnowledgeExtractionService({ parserRegistry, parse: parseDeterministically, repository: knowledgeExtractionRepository, auditRepository: identityRepository });
const importedFactEventMapperService = createImportedFactEventMapperService({ registry: importedFactMapperRegistry, linkRepository: importedFactEventLinkRepository, businessEventService });
const listeningService = createListeningService({ sourceRegistry: listeningSourceRegistry, repository: listeningRepository, auditRepository: identityRepository });
const listeningEventMapperService = createListeningEventMapperService({ registry: listeningEventMapperRegistry, repository: listeningRepository, businessEventService });
const listeningIntelligenceService = createListeningIntelligenceService({ repository:listeningIntelligenceRepository, contextGateway:businessContextConsumerGateway, intelligenceRepository:intelligenceRecordRepository, featureRepository:featureValueRepository });
const semanticIntelligenceService = createSemanticIntelligenceService({ repository: semanticFindingRepository, registry: semanticContractRegistry, contextGateway: businessContextConsumerGateway });
const recommendationIntelligenceService = createRecommendationIntelligenceService({ repository: intelligenceRecommendationRepository, semanticRepository: semanticFindingRepository, registry: recommendationContractRegistry, contextGateway: businessContextConsumerGateway });
const humanGovernanceRepository = createHumanGovernanceRepository(db);
const recommendationFreshnessQuery = createRecommendationFreshnessQuery({ recommendationRepository: intelligenceRecommendationRepository, currentContextState: () => { const current = businessContextService.getCurrent(); return { contextVersionId: current.activeContext?.id || null, isStale: current.isStale }; } });
const humanGovernanceService = createHumanGovernanceService({ repository: humanGovernanceRepository, recommendationRepository: intelligenceRecommendationRepository, freshnessQuery: recommendationFreshnessQuery });
const actionProposalRepository = createActionProposalRepository(db);
const actionProposalService = createActionProposalService({ repository: actionProposalRepository, registry: actionProposalContractRegistry, decisionQuery: humanGovernanceRepository, recommendationRepository: intelligenceRecommendationRepository });
const executionAuthorizationRepository = createExecutionAuthorizationRepository(db);
const executionAuthorizationService = createExecutionAuthorizationService({ repository: executionAuthorizationRepository, proposalQuery: actionProposalRepository, policyRegistry: authorizationPolicyRegistry });
const executionRequestRepository = createExecutionRequestRepository(db);
const executionRequestService = createExecutionRequestService({ repository: executionRequestRepository, authorizationQuery: executionAuthorizationRepository, proposalQuery: actionProposalRepository, currentnessQuery: { isCurrent: () => false }, policyRegistry: executionRequestPolicyRegistry, providerIdentityQuery: { resolve: () => null } });
const providerAccountIdentityRepository = createProviderAccountIdentityRepository(db);
const providerAccountIdentityService = createProviderAccountIdentityService({ repository: providerAccountIdentityRepository, verifierRegistry: providerIdentityVerifierRegistry });
const executionLedgerRepository = createExecutionLedgerRepository(db);
const executionLedgerService = createExecutionLedgerService({ repository: executionLedgerRepository, capabilityRegistry: executionCapabilityRegistry, attemptPolicyRegistry });
const executionDispatchJobRepository = createExecutionDispatchJobRepository(db);
createExecutionDispatchJobService({ repository: executionDispatchJobRepository, capabilityRegistry: executionCapabilityRegistry, attemptPolicyRegistry });

app.use(
  "/api/auth",
  createAuthRouter({
    authService,
    nodeEnv: environment.nodeEnv,
    exposeDevelopmentOtp: environment.exposeDevelopmentOtp,
  })
);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Loadder API",
    environment: environment.nodeEnv,
    database: {
      status: "ready",
      engine: "SQLite",
      migrations: appliedMigrations.map(({ version, name }) => ({
        version,
        name,
      })),
    },
    ai: {
      openaiConfigured: environment.openAIConfigured,
      cloudflareConfigured: environment.cloudflareAIConfigured,
      businessBrainConfigured: businessBrainService.readiness().configured,
      contentTextGenerationConfigured: environment.openAIConfigured,
      providerAvailability: "not-probed",
      economy: aiEconomyService.readiness(),
    },
    assets: {
      assetStorageConfigured: contentAssetStore.configured,
      assetUploadEnabled: contentAssetStore.uploadEnabled,
    },
    landing: landingCommercializationService.readiness(),
    payment: paymentOrderService.readiness(),
    shipping: inventoryFulfillmentService.readiness(),
    returns: returnRefundService.readiness(),
    publishing: domainPublishingService.readiness(),
    auth: {
      mode: "persistent-session",
      productionReady: false,
      otpDelivery: "not-connected",
    },
    timestamp: new Date().toISOString(),
  });
});

app.use(createLandingPublicRouter({ service: landingCommercializationService, rateLimiter: createLandingPublicRateLimiter() }));
app.use(createPublicFormsRouter({ service: secureFormsCrmService }));
app.use(createCartCheckoutRouter({ service: cartCheckoutService }));
app.use(createPaymentOrderRouter({ service: paymentOrderService, customerReturnBaseUrl: environment.clientOrigins[0] || "" }));
app.use(createReturnPublicRouter({ service: returnRefundService }));
app.use(createMarketplacePublicRouter({ marketplaceService: marketplaceCommerceService }));
app.use(createPublicHostRouter({ service: domainPublishingService }));
app.use((error, req, res, next) => {
  if (req.path === "/api/public/landing/events" && error?.type === "entity.too.large") return res.status(413).json({ success: false, code: "LANDING_PUBLIC_BODY_TOO_LARGE", message: "Landing public operation could not be completed." });
  return next(error);
});

app.use(createRequireAuth(authService));
app.use(
  "/api/workspaces",
  createWorkspaceRouter({ authService })
);
app.use(createRequireWorkspace(identityRepository));
app.use((req, res, next) =>
  runWithWorkspace(req.workspace.id, next)
);
app.use(createInternalAccessMiddleware({
  token: environment.internalAccessToken,
  nodeEnv: environment.nodeEnv,
}));
app.use(createApiProductGate(productPolicy));
app.use(
  "/api/business-profile",
  createBusinessProfileRouter({ businessProfileService })
);
app.use(
  "/api/business-dna",
  createBusinessDnaRouter({ businessDnaService })
);
app.use(
  "/api/brand-book",
  createBrandBookRouter({ brandBookService })
);
app.use(
  "/api/business-context",
  createBusinessContextRouter({ businessContextService })
);
app.use(
  "/api/onboarding",
  createOnboardingRouter({ onboardingService })
);
app.use(
  "/api/text-ai/context",
  createTextAiContextRouter({ textAiContextConsumer })
);
app.use("/api", createContentGenerationRouter({ service: contentGenerationService }));
app.use("/api", createContentItemRouter({ service: contentItemService }));
app.use("/api", createContentAssetRouter({ service: contentAssetService }));
app.use("/api", createCreativePlacementRouter({ service: creativePlacementService }));
app.use("/api", createCreativeIntentRouter({ service: creativeIntentService }));
app.use("/api", createDistributionContextRouter({ service: distributionContextService }));
app.use("/api", createAttributionTouchRouter({ service: attributionTouchService }));
app.use("/api", createPerformanceObservationRouter({ service: performanceObservationService }));
app.use("/api", createLandingRouter({ service: landingService }));
app.use("/api", createLandingCommercializationRouter({ service: landingCommercializationService }));
app.use("/api", createWebsiteRouter({ service: websiteService }));
app.use("/api", createGrowthWorkflowRouter({ service: growthWorkflowService }));
app.use("/api", createImprovementCycleRouter({ service: improvementCycleService }));
app.use("/api", createSystemConstraintRouter({ service: systemConstraintService }));
app.use("/api", createInternalTqmRouter({ service: internalTqmService }));
app.use("/api", createInternalTqmPdcaRouter({ service: internalTqmService }));
app.use("/api", createAiEconomyRouter({ economyService: aiEconomyService, policyRegistry: aiOperationPolicyRegistry, budgetGovernor: aiBudgetGovernor, benchmarkRegistry: persianAiBenchmarkRegistry, patternRegistry: growthPatternRegistry, learnedPolicy: learnedIntelligencePolicy }));
app.use("/api", createCommerceCatalogRouter({ service: commerceCatalogService }));
app.use("/api", createMarketplaceCommerceRouter({ marketplaceService: marketplaceCommerceService, bulkService: commerceBulkService, integrationHubService }));
app.use("/api", createDomainPublishingRouter({ service: domainPublishingService }));
app.use("/api", createSecureFormsCrmRouter({ service: secureFormsCrmService }));
app.use("/api", createInventoryFulfillmentRouter({ service: inventoryFulfillmentService }));
app.use("/api", createReturnRefundRouter({ service: returnRefundService }));
app.use(
  "/api",
  createIntelligenceDataRouter({ businessEventService, intelligenceQueryService })
);
app.use(
  "/api",
  createFeatureValueRouter({ featureQueryService })
);
app.use(
  "/api",
  createModelEvaluationRouter({ service: modelEvaluationService })
);
app.use("/api", createForecastRouter({ service: forecastService }));
app.use("/api", createIntegrationRouter({ service: integrationService }));
app.use("/api", createKnowledgeKpiRouter({ service: knowledgeKpiService }));
app.use("/api", createKnowledgeExtractionRouter({ service: knowledgeExtractionService }));
app.use("/api", createImportedFactMappingRouter({ service: importedFactEventMapperService }));
app.use("/api", createListeningRouter({ service: listeningService, mapper: listeningEventMapperService }));
app.use("/api", createListeningIntelligenceRouter({ service: listeningIntelligenceService }));
app.use("/api", createSemanticIntelligenceRouter({ service: semanticIntelligenceService }));
app.use("/api", createRecommendationIntelligenceRouter({ service: recommendationIntelligenceService }));
app.use("/api", createHumanGovernanceRouter({ service: humanGovernanceService }));
app.use("/api", createActionProposalRouter({ service: actionProposalService }));
app.use("/api", createExecutionAuthorizationRouter({ service: executionAuthorizationService }));
app.use("/api", createExecutionRequestRouter({ service: executionRequestService }));
app.use("/api", createProviderAccountIdentityRouter({ service: providerAccountIdentityService }));
app.use("/api", createExecutionLedgerRouter({ service: executionLedgerService }));
app.use("/api", createLegacyCrmRouter({ getCRMStats, getCustomers, getCustomerById, createCustomer, getCustomer360 }));
app.use("/api", createLegacyAutomationsRouter({ getAutomations, getAutomationById, createAutomation, updateAutomation, deleteAutomation }));
app.use("/api", createLegacyMarketingRouter({ getMarketingChannels, getMarketingPlatforms, getAdvertisingServices, getMarketingCampaigns }));
app.use("/api", createAiRouter({ businessBrainService, readiness: () => ({ openaiConfigured: environment.openAIConfigured, cloudflareConfigured: environment.cloudflareAIConfigured, businessBrainConfigured: businessBrainService.readiness().configured, contentGenerationConfigured: environment.openAIConfigured, providerAvailability: "not-probed" }) }));

/* =========================================================
   CAMPAIGN RUNTIME CONFIG
========================================================= */

/*
  فعلاً Control Mode / Guardrails / Targets
  در حافظه Runtime نگهداری می‌شوند.

  مرحله بعد این بخش را Persistent می‌کنیم
  و داخل SQLite ذخیره می‌کنیم.
*/

const campaignRuntimeConfigs = createWorkspaceRuntimeStore(() => ({
  controlMode: CONTROL_MODES.COPILOT,
  guardrails: buildDefaultGuardrails(),
  targets: {
    roasMin: 2,
    cpcMax: null,
    cpsMax: null,
    cplMax: null,
    cpoMax: null,
    cacMax: null,
    ctrMin: null,
    sessionRateMin: null,
  },
  trackingHealthy: true,
  updatedAt: new Date().toISOString(),
}));

function getCampaignRuntimeConfig(
  campaignId
) {
  return campaignRuntimeConfigs.get(
    requireWorkspaceId(),
    campaignId
  );
}

function updateCampaignRuntimeConfig(
  campaignId,
  updates = {}
) {
  const current =
    getCampaignRuntimeConfig(
      campaignId
    );

  const next = {
    ...current,
    ...updates,

    guardrails: {
      ...current.guardrails,
      ...(updates.guardrails ||
        {}),
    },

    targets: {
      ...current.targets,
      ...(updates.targets ||
        {}),
    },

    updatedAt:
      new Date().toISOString(),
  };

  campaignRuntimeConfigs.set(
    requireWorkspaceId(),
    campaignId,
    next
  );

  return next;
}

app.use("/api", createLegacyCampaignsRouter({
  getCampaignById, createMarketingCampaign, getCampaignMetrics, saveCampaignMetric,
  calculateCampaignKPIs, getAttributionTouchpoints, getCampaignAttributedPerformance,
  getCampaignRuntimeConfig, updateCampaignRuntimeConfig,
  defaultControlMode: CONTROL_MODES.COPILOT,
}));
app.use("/api", createLegacyAttributionRouter({
  getAttributionTouchpoints, createAttributionTouchpoint,
}));

/* =========================================================
   DEFAULT AUTOMATIONS
========================================================= */

const defaultAutomations = [
  {
    id: "abandoned-cart",

    title:
      "بازیابی سبد خرید رهاشده",

    trigger:
      "cart.abandoned",

    enabled: true,

    delayMinutes: 120,

    conditions: [
      {
        field:
          "cartValue",

        operator:
          "gte",

        value: 0,
      },
    ],

    actions: [
      {
        type:
          "send_message",

        channel:
          "sms",

        template:
          "cart_recovery",
      },
    ],
  },

  {
    id:
      "hot-lead",

    title:
      "پیگیری لید داغ",

    trigger:
      "lead.hot",

    enabled: true,

    delayMinutes: 0,

    conditions: [
      {
        field:
          "score",

        operator:
          "gte",

        value: 80,
      },
    ],

    actions: [
      {
        type:
          "create_task",

        assignee:
          "sales",

        template:
          "hot_lead_followup",
      },
    ],
  },

  {
    id:
      "order-completed",

    title:
      "پیگیری پس از خرید",

    trigger:
      "order.completed",

    enabled: true,

    delayMinutes: 10,

    conditions: [],

    actions: [
      {
        type:
          "send_message",

        channel:
          "sms",

        template:
          "purchase_thank_you",
      },
    ],
  },

  {
    id:
      "repeat-purchase",

    title:
      "پیشنهاد مشتری تکرارشونده",

    trigger:
      "customer.repeat_purchase",

    enabled: true,

    delayMinutes: 0,

    conditions: [
      {
        field:
          "orderCount",

        operator:
          "gte",

        value: 2,
      },
    ],

    actions: [
      {
        type:
          "send_offer",

        channel:
          "sms",

        template:
          "repeat_customer_offer",
      },
    ],
  },

  {
    id:
      "churn-risk",

    title:
      "بازگشت مشتری در معرض ریزش",

    trigger:
      "customer.churn_risk",

    enabled: true,

    delayMinutes: 0,

    conditions: [
      {
        field:
          "riskScore",

        operator:
          "gte",

        value: 70,
      },
    ],

    actions: [
      {
        type:
          "create_campaign",

        channel:
          "crm",

        template:
          "winback_campaign",
      },
    ],
  },

  {
    id:
      "high-cac",

    title:
      "هشدار هزینه جذب بالا",

    trigger:
      "marketing.cac_high",

    enabled: true,

    delayMinutes: 0,

    conditions: [
      {
        field:
          "cac",

        operator:
          "gte",

        value:
          500000,
      },
    ],

    actions: [
      {
        type:
          "create_alert",

        channel:
          "dashboard",

        template:
          "high_cac_alert",
      },
    ],
  },

  {
    id:
      "conversion-drop",

    title:
      "هشدار افت نرخ تبدیل",

    trigger:
      "website.conversion_drop",

    enabled: true,

    delayMinutes: 0,

    conditions: [
      {
        field:
          "conversionRate",

        operator:
          "lte",

        value: 5.5,
      },
    ],

    actions: [
      {
        type:
          "create_alert",

        channel:
          "dashboard",

        template:
          "conversion_drop_alert",
      },
    ],
  },
];

/* =========================================================
   SEED
========================================================= */

if (environment.seedDemoData) {
  seedDefaultAutomations(defaultAutomations);
  seedCRMData();
  seedMarketingData();
}

/* =========================================================
   WORKFLOW HELPERS
========================================================= */

function evaluateCondition(
  eventPayload,
  condition
) {
  const actualValue =
    eventPayload[
      condition.field
    ];

  const expectedValue =
    condition.value;

  if (
    actualValue ===
    undefined
  ) {
    return false;
  }

  switch (
    condition.operator
  ) {
    case "eq":
      return (
        actualValue ===
        expectedValue
      );

    case "neq":
      return (
        actualValue !==
        expectedValue
      );

    case "gt":
      return (
        actualValue >
        expectedValue
      );

    case "gte":
      return (
        actualValue >=
        expectedValue
      );

    case "lt":
      return (
        actualValue <
        expectedValue
      );

    case "lte":
      return (
        actualValue <=
        expectedValue
      );

    default:
      return false;
  }
}

function workflowMatches(
  workflow,
  event
) {
  if (!workflow.enabled) {
    return false;
  }

  if (
    workflow.trigger !==
    event.type
  ) {
    return false;
  }

  return workflow.conditions.every(
    (condition) =>
      evaluateCondition(
        event.payload,
        condition
      )
  );
}

function buildMessage(
  action,
  event
) {
  const customerName =
    event.payload
      .customerName ||
    event.payload
      .leadName ||
    "مشتری عزیز";

  switch (
    action.template
  ) {
    case "cart_recovery":
      return `${customerName}، سبد خرید شما هنوز منتظر شماست. برای تکمیل خرید به فروشگاه برگردید.`;

    case "purchase_thank_you":
      return `${customerName}، از خرید شما متشکریم. سفارش شما با موفقیت ثبت شد.`;

    case "repeat_customer_offer":
      return `${customerName}، از اینکه دوباره ما را انتخاب کردید متشکریم. یک پیشنهاد ویژه برای شما داریم.`;

    case "custom_message":
      return `${customerName}، یک پیام خودکار از Loadder برای شما ارسال شده است.`;

    case "custom_offer":
      return `${customerName}، یک پیشنهاد ویژه برای شما آماده شده است.`;

    default:
      return `${customerName}، پیام خودکار Loadder`;
  }
}

/* =========================================================
   WORKFLOW ENGINE
========================================================= */

async function executeAction(
  action,
  event,
  workflow
) {
  assertLegacyOperationEnabled(productPolicy, "legacy_automation");
  let executionResult = {
    ok: true,

    status:
      "simulated",
  };

  if (
    action.type ===
      "send_message" ||
    action.type ===
      "send_offer"
  ) {
    const recipient =
      action.channel ===
      "email"
        ? event.payload
            .email ||
          event.payload
            .recipient
        : event.payload
            .phone ||
          event.payload
            .recipient;

    executionResult =
      assertLegacyOperationEnabled(productPolicy, "legacy_messaging");
      await sendLegacyMessage({
        channel:
          action.channel ||
          "sms",

        recipient,

        message:
          buildMessage(
            action,
            event
          ),

        metadata: {
          eventId:
            event.id,

          eventType:
            event.type,

          workflowId:
            workflow.id,

          workflowTitle:
            workflow.title,

          customerId:
            event.payload
              .customerId ||
            null,

          leadId:
            event.payload
              .leadId ||
            null,

          orderId:
            event.payload
              .orderId ||
            null,
        },
      });
  }

  if (
    action.type ===
    "create_task"
  ) {
    executionResult = {
      ok: true,

      provider:
        "loadder-simulator",

      action:
        "create_task",

      assignee:
        action.assignee ||
        "sales",

      status:
        "simulated",
    };
  }

  if (
    action.type ===
    "create_campaign"
  ) {
    executionResult = {
      ok: true,

      provider:
        "loadder-simulator",

      action:
        "create_campaign",

      status:
        "simulated",
    };
  }

  if (
    action.type ===
    "create_alert"
  ) {
    executionResult = {
      ok: true,

      provider:
        "loadder-simulator",

      action:
        "create_alert",

      status:
        "simulated",
    };
  }

  const execution = {
    id:
      crypto.randomUUID(),

    timestamp:
      new Date()
        .toISOString(),

    eventId:
      event.id,

    eventType:
      event.type,

    workflowId:
      workflow.id,

    workflowTitle:
      workflow.title,

    actionType:
      action.type,

    channel:
      action.channel ||
      null,

    template:
      action.template ||
      null,

    recipient:
      event.payload
        .phone ||
      event.payload
        .email ||
      event.payload
        .recipient ||
      null,

    status:
      executionResult
        .status ||
      "completed",

    result:
      executionResult,
  };

  saveExecution(
    execution
  );

  return execution;
}

async function runWorkflow(
  workflow,
  event
) {
  assertLegacyOperationEnabled(productPolicy, "legacy_automation");
  const executions = [];

  for (
    const action
    of workflow.actions
  ) {
    const execution =
      await executeAction(
        action,
        event,
        workflow
      );

    executions.push(
      execution
    );
  }

  return {
    workflowId:
      workflow.id,

    workflowTitle:
      workflow.title,

    delayMinutes:
      workflow.delayMinutes,

    executions,
  };
}

async function processEvent(
  event
) {
  assertLegacyOperationEnabled(productPolicy, "legacy_automation");
  saveEvent(event);

  if (
    event.payload
      .customerId
  ) {
    createCustomerEvent({
      customerId:
        event.payload
          .customerId,

      type:
        event.type,

      metadata:
        event.payload,
    });
  }

  const automations =
    getAutomations();

  const matchedWorkflows =
    automations.filter(
      (workflow) =>
        workflowMatches(
          workflow,
          event
        )
    );

  const results =
    await Promise.all(
      matchedWorkflows.map(
        (workflow) =>
          runWorkflow(
            workflow,
            event
          )
      )
    );

  return {
    matchedWorkflows,
    results,
  };
}

/* =========================================================
   OPTIMIZER CAPABILITIES
========================================================= */

app.get(
  "/api/marketing/optimizer/capabilities",
  (req, res) => {
    try {
      res.json({
        ok: true,

        data:
          getOptimizerCapabilities(),
      });
    } catch (error) {
      console.error(
        "Optimizer capabilities error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت قابلیت‌های Optimizer.",
        });
    }
  }
);

/* =========================================================
   AI CAMPAIGN PLANNER
========================================================= */

app.post(
  "/api/marketing/planner",
  (req, res) => {
    try {
      const {
        goal,

        targetAudience =
          {},

        product =
          {},

        budget =
          {},

        timeline =
          {},

        scenario =
          "balanced",

        controlMode =
          CONTROL_MODES.COPILOT,

        targetKPIs =
          {},
      } = req.body;

      if (!goal) {
        return res
          .status(400)
          .json({
            ok: false,

            message:
              "هدف کمپین الزامی است.",
          });
      }

      if (
        !budget.total ||
        Number(
          budget.total
        ) <= 0
      ) {
        return res
          .status(400)
          .json({
            ok: false,

            message:
              "بودجه کل کمپین باید بیشتر از صفر باشد.",
          });
      }

      const plan =
        planCampaign({
          goal,

          targetAudience,

          product,

          budget,

          timeline,

          scenario,

          controlMode,

          targetKPIs,
        });

      res.json({
        ok: true,

        data:
          plan,
      });
    } catch (error) {
      console.error(
        "Campaign planner error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ساخت Media Plan.",
        });
    }
  }
);

/* =========================================================
   PLANNER SCENARIOS
========================================================= */

app.post(
  "/api/marketing/planner/scenarios",
  (req, res) => {
    try {
      const {
        goal,
        budget,
      } = req.body;

      if (!goal) {
        return res
          .status(400)
          .json({
            ok: false,

            message:
              "هدف کمپین الزامی است.",
          });
      }

      if (
        !budget?.total ||
        Number(
          budget.total
        ) <= 0
      ) {
        return res
          .status(400)
          .json({
            ok: false,

            message:
              "بودجه کل کمپین الزامی است.",
          });
      }

      const scenarios =
        buildCampaignScenarios(
          req.body
        );

      res.json({
        ok: true,

        data:
          scenarios,
      });
    } catch (error) {
      console.error(
        "Planner scenarios error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ساخت سناریوهای کمپین.",
        });
    }
  }
);

/* =========================================================
   DIRECT CUSTOMER MESSAGE
========================================================= */

app.post(
  "/api/customers/:id/message",
  async (req, res) => {
    const customer =
      getCustomerById(
        req.params.id
      );

    if (!customer) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "مشتری پیدا نشد.",
        });
    }

    const {
      channel = "sms",
      message,
    } = req.body;

    if (
      channel !==
        "sms" &&
      channel !==
        "email"
    ) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "کانال پیام باید sms یا email باشد.",
        });
    }

    if (
      !message ||
      typeof message !==
        "string" ||
      !message.trim()
    ) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "متن پیام الزامی است.",
        });
    }

    const recipient =
      channel === "email"
        ? customer.email
        : customer.phone;

    if (!recipient) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            channel ===
            "email"
              ? "برای این مشتری ایمیل ثبت نشده است."
              : "برای این مشتری شماره موبایل ثبت نشده است.",
        });
    }

    const event = {
      id:
        crypto.randomUUID(),

      type:
        "customer.direct_message",

      createdAt:
        new Date()
          .toISOString(),

      payload: {
        customerId:
          customer.id,

        customerName:
          customer.name,

        phone:
          customer.phone,

        email:
          customer.email,

        channel,

        recipient,

        message:
          message.trim(),
      },
    };

    try {
      saveEvent(event);

      createCustomerEvent({
        customerId:
          customer.id,

        type:
          "customer.direct_message",

        metadata: {
          channel,

          recipient,

          message:
            message.trim(),
        },
      });

      const result =
        assertLegacyOperationEnabled(productPolicy, "legacy_messaging");
        await sendLegacyMessage({
          channel,

          recipient,

          message:
            message.trim(),

          metadata: {
            customerId:
              customer.id,

            customerName:
              customer.name,

            eventId:
              event.id,

            eventType:
              event.type,

            source:
              "customer_360",
          },
        });

      const execution = {
        id:
          crypto.randomUUID(),

        timestamp:
          new Date()
            .toISOString(),

        eventId:
          event.id,

        eventType:
          event.type,

        workflowId:
          "manual-customer-message",

        workflowTitle:
          "ارسال مستقیم از CRM",

        actionType:
          "send_message",

        channel,

        template:
          "manual_message",

        recipient,

        status:
          result?.status ||
          "completed",

        result,
      };

      saveExecution(
        execution
      );

      res.json({
        ok: true,

        data: {
          customer: {
            id:
              customer.id,

            name:
              customer.name,
          },

          channel,

          recipient,

          execution,
        },
      });
    } catch (error) {
      console.error(
        "Direct message error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ارسال پیام به مشتری.",
        });
    }
  }
);

/* =========================================================
   CUSTOMER EVENTS
========================================================= */

app.get(
  "/api/customers/:id/events",
  (req, res) => {
    try {
      const customer =
        getCustomerById(
          req.params.id
        );

      if (!customer) {
        return res
          .status(404)
          .json({
            ok: false,

            message:
              "مشتری پیدا نشد.",
          });
      }

      const data =
        getCustomerEvents(
          req.params.id
        );

      res.json({
        ok: true,

        count:
          data.length,

        data,
      });
    } catch (error) {
      console.error(
        "Customer events error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت رویدادهای مشتری.",
        });
    }
  }
);

/* =========================================================
   LEADS
========================================================= */

app.get(
  "/api/leads",
  (req, res) => {
    const data =
      getLeads();

    res.json({
      ok: true,

      count:
        data.length,

      data,
    });
  }
);

app.get(
  "/api/leads/:id",
  (req, res) => {
    const lead =
      getLeadById(
        req.params.id
      );

    if (!lead) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "لید پیدا نشد.",
        });
    }

    const attribution =
      getAttributionTouchpoints({
        leadId:
          lead.id,
      });

    res.json({
      ok: true,

      data: {
        lead,

        attribution: {
          count:
            attribution.length,

          touchpoints:
            attribution,
        },
      },
    });
  }
);

app.patch(
  "/api/leads/:id",
  (req, res) => {
    try {
      const lead =
        updateLead(
          req.params.id,
          req.body
        );

      if (!lead) {
        return res
          .status(404)
          .json({
            ok: false,

            message:
              "لید پیدا نشد.",
          });
      }

      res.json({
        ok: true,

        data:
          lead,
      });
    } catch (error) {
      console.error(
        "Update lead error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ویرایش لید.",
        });
    }
  }
);

app.post(
  "/api/leads",
  async (req, res) => {
    const {
      name,
      phone,
      email,
      company,
      source,

      score = 0,

      status = "new",

      opportunityValue =
        0,

      campaignId =
        null,

      channelId =
        null,

      platformId =
        null,

      serviceId =
        null,

      sessionId =
        null,

      externalClickId =
        null,

      touchType =
        "lead_created",

      attributionMetadata =
        {},
    } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "نام لید الزامی است.",
        });
    }

    try {
      const lead =
        createLead({
          name,
          phone,
          email,
          company,
          source,
          score,
          status,
          opportunityValue,
        });

      let attribution =
        null;

      if (
        campaignId ||
        channelId ||
        platformId ||
        serviceId ||
        sessionId ||
        externalClickId
      ) {
        attribution =
          createAttributionTouchpoint({
            leadId:
              lead.id,

            campaignId,

            channelId,

            platformId,

            serviceId,

            touchType,

            sessionId,

            externalClickId,

            metadata: {
              source,

              ...attributionMetadata,
            },
          });
      }

      if (
        Number(score) >=
        80
      ) {
        const event = {
          id:
            crypto.randomUUID(),

          type:
            "lead.hot",

          createdAt:
            new Date()
              .toISOString(),

          payload: {
            leadId:
              lead.id,

            leadName:
              name,

            phone,

            email,

            score:
              Number(score),

            campaignId,

            channelId,

            platformId,

            serviceId,
          },
        };

        await processEvent(
          event
        );
      }

      res
        .status(201)
        .json({
          ok: true,

          data: {
            lead,

            attribution,
          },
        });
    } catch (error) {
      console.error(
        "Create lead error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ساخت لید.",
        });
    }
  }
);

/* =========================================================
   LEAD → CUSTOMER
========================================================= */

app.post(
  "/api/leads/:id/convert",
  async (req, res) => {
    const lead =
      getLeadById(
        req.params.id
      );

    if (!lead) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "لید پیدا نشد.",
        });
    }

    try {
      const conversion =
        convertLeadToCustomer(
          lead.id,
          req.body || {}
        );

      if (!conversion) {
        return res
          .status(500)
          .json({
            ok: false,

            message:
              "تبدیل لید انجام نشد.",
          });
      }

      let transferred =
        [];

      if (
        conversion.customer &&
        !conversion
          .alreadyConverted
      ) {
        transferred =
          transferLeadAttributionToCustomer(
            lead.id,

            conversion
              .customer.id
          );
      }

      const event = {
        id:
          crypto.randomUUID(),

        type:
          "lead.converted",

        createdAt:
          new Date()
            .toISOString(),

        payload: {
          leadId:
            lead.id,

          customerId:
            conversion
              .customer?.id ||
            null,

          leadName:
            lead.name,

          customerName:
            conversion
              .customer?.name ||
            lead.name,

          phone:
            conversion
              .customer?.phone ||
            lead.phone,

          email:
            conversion
              .customer?.email ||
            lead.email,

          source:
            lead.source,

          attributionCount:
            transferred.length,
        },
      };

      await processEvent(
        event
      );

      res.json({
        ok: true,

        data: {
          ...conversion,

          attribution: {
            transferred:
              transferred.length,

            touchpoints:
              transferred,
          },
        },
      });
    } catch (error) {
      console.error(
        "Lead conversion error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در تبدیل لید به مشتری.",
        });
    }
  }
);

/* =========================================================
   ORDERS
========================================================= */

app.get(
  "/api/orders",
  (req, res) => {
    const data =
      getOrders();

    res.json({
      ok: true,

      count:
        data.length,

      data,
    });
  }
);

app.post(
  "/api/orders",
  async (req, res) => {
    const {
      customerId,

      totalAmount,

      status =
        "completed",

      source =
        "website",

      paymentStatus =
        "paid",
    } = req.body;

    if (
      !customerId ||
      totalAmount ===
        undefined
    ) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "customerId و totalAmount الزامی هستند.",
        });
    }

    const customer =
      getCustomerById(
        customerId
      );

    if (!customer) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "مشتری پیدا نشد.",
        });
    }

    try {
      const order =
        createOrder({
          customerId,

          totalAmount:
            Number(
              totalAmount
            ),

          status,

          source,

          paymentStatus,
        });

      let attribution = {
        attributed:
          false,

        reason:
          "order_not_completed_or_paid",
      };

      if (
        status ===
          "completed" &&
        paymentStatus ===
          "paid"
      ) {
        attribution =
          attributeOrderToCustomerCampaign({
            customerId,

            orderId:
              order.id,

            revenue:
              Number(
                totalAmount
              ),
          });
      }

      if (
        status ===
        "completed"
      ) {
        const event = {
          id:
            crypto.randomUUID(),

          type:
            "order.completed",

          createdAt:
            new Date()
              .toISOString(),

          payload: {
            customerId,

            customerName:
              customer.name,

            phone:
              customer.phone,

            email:
              customer.email,

            orderId:
              order.id,

            amount:
              Number(
                totalAmount
              ),

            paymentStatus,

            attributed:
              attribution
                .attributed ||
              false,

            campaignId:
              attribution
                .campaignId ||
              null,
          },
        };

        await processEvent(
          event
        );
      }

      res
        .status(201)
        .json({
          ok: true,

          data: {
            order,

            attribution,
          },
        });
    } catch (error) {
      console.error(
        "Create order error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ساخت سفارش.",
        });
    }
  }
);

/* =========================================================
   CARTS
========================================================= */

app.get(
  "/api/carts",
  (req, res) => {
    const data =
      getCarts();

    res.json({
      ok: true,

      count:
        data.length,

      data,
    });
  }
);

app.post(
  "/api/carts",
  async (req, res) => {
    const {
      customerId =
        null,

      totalAmount =
        0,

      status =
        "active",
    } = req.body;

    try {
      const cart =
        createCart({
          customerId,

          totalAmount:
            Number(
              totalAmount
            ),

          status,

          abandonedAt:
            status ===
            "abandoned"
              ? new Date()
                  .toISOString()
              : null,
        });

      if (
        status ===
        "abandoned"
      ) {
        const customer =
          customerId
            ? getCustomerById(
                customerId
              )
            : null;

        const event = {
          id:
            crypto.randomUUID(),

          type:
            "cart.abandoned",

          createdAt:
            new Date()
              .toISOString(),

          payload: {
            customerId,

            customerName:
              customer?.name ||
              null,

            phone:
              customer?.phone ||
              null,

            email:
              customer?.email ||
              null,

            cartId:
              cart.id,

            cartValue:
              Number(
                totalAmount
              ),
          },
        };

        await processEvent(
          event
        );
      }

      res
        .status(201)
        .json({
          ok: true,

          data:
            cart,
        });
    } catch (error) {
      console.error(
        "Create cart error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ساخت سبد خرید.",
        });
    }
  }
);

/* =========================================================
   MANUAL WORKFLOW
========================================================= */

app.post(
  "/api/automations/:id/run",
  async (req, res) => {
    const workflow =
      getAutomationById(
        req.params.id
      );

    if (!workflow) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "اتوماسیون پیدا نشد.",
        });
    }

    if (!workflow.enabled) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "این Workflow متوقف است.",
        });
    }

    const event = {
      id:
        crypto.randomUUID(),

      type:
        workflow.trigger,

      createdAt:
        new Date()
          .toISOString(),

      payload:
        req.body?.payload ||
        {},
    };

    try {
      const result =
        await processEvent(
          event
        );

      res.json({
        ok: true,

        event,

        result,
      });
    } catch (error) {
      console.error(
        "Manual workflow error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در اجرای Workflow.",
        });
    }
  }
);

/* =========================================================
   EVENTS
========================================================= */

app.post(
  "/api/events",
  async (req, res) => {
    const {
      type,

      payload =
        {},
    } = req.body;

    if (!type) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "نوع Event الزامی است.",
        });
    }

    const event = {
      id:
        crypto.randomUUID(),

      type,

      payload,

      createdAt:
        new Date()
          .toISOString(),
    };

    try {
      const {
        matchedWorkflows,
        results,
      } =
        await processEvent(
          event
        );

      res.json({
        ok: true,

        event,

        matchedWorkflows:
          matchedWorkflows
            .length,

        results,
      });
    } catch (error) {
      console.error(
        "Process event error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در پردازش Event.",
        });
    }
  }
);

/* =========================================================
   EXECUTIONS
========================================================= */

app.get(
  "/api/executions",
  (req, res) => {
    const limit =
      Number(
        req.query.limit
      ) || 100;

    const data =
      getExecutions(
        limit
      );

    res.json({
      ok: true,

      count:
        data.length,

      data,
    });
  }
);

app.delete(
  "/api/executions",
  (req, res) => {
    try {
      clearExecutions();

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "Clear executions error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در پاک‌کردن تاریخچه.",
        });
    }
  }
);

/* =========================================================
   CAMPAIGN OPTIMIZATION
========================================================= */

app.get(
  "/api/marketing/campaigns/:id/optimization",
  (req, res) => {
    try {
      const campaign =
        getCampaignById(
          req.params.id
        );

      if (!campaign) {
        return res
          .status(404)
          .json({
            ok: false,

            message:
              "کمپین پیدا نشد.",
          });
      }

      const performance =
        getCampaignAttributedPerformance(
          campaign.id
        );

      const config =
        getCampaignRuntimeConfig(
          campaign.id
        );

      const optimization =
        optimizeCampaign({
          campaign,

          performance,

          targets:
            config.targets,

          guardrails:
            config.guardrails,

          controlMode:
            config.controlMode,

          trackingHealthy:
            config.trackingHealthy,
        });

      res.json({
        ok: true,

        data: {
          campaign,

          performance,

          control:
            config,

          optimization,
        },
      });
    } catch (error) {
      console.error(
        "Campaign optimization error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در تحلیل Optimize کمپین.",
        });
    }
  }
);

/* =========================================================
   CONTROL MODE
========================================================= */

app.get(
  "/api/marketing/campaigns/:id/control-mode",
  (req, res) => {
    const campaign =
      getCampaignById(
        req.params.id
      );

    if (!campaign) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "کمپین پیدا نشد.",
        });
    }

    const config =
      getCampaignRuntimeConfig(
        campaign.id
      );

    res.json({
      ok: true,

      data: {
        campaignId:
          campaign.id,

        controlMode:
          getControlModeDefinition(
            config.controlMode
          ),

        raw:
          config.controlMode,
      },
    });
  }
);

app.post(
  "/api/marketing/campaigns/:id/control-mode",
  (req, res) => {
    const campaign =
      getCampaignById(
        req.params.id
      );

    if (!campaign) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "کمپین پیدا نشد.",
        });
    }

    const {
      mode,
    } = req.body;

    const allowed = [
      CONTROL_MODES.MANUAL,
      CONTROL_MODES.COPILOT,
      CONTROL_MODES.AUTOPILOT,
    ];

    if (
      !allowed.includes(
        mode
      )
    ) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "mode باید manual، copilot یا autopilot باشد.",
        });
    }

    const config =
      updateCampaignRuntimeConfig(
        campaign.id,
        {
          controlMode:
            mode,
        }
      );

    res.json({
      ok: true,

      data: {
        campaignId:
          campaign.id,

        controlMode:
          getControlModeDefinition(
            config.controlMode
          ),

        config,
      },
    });
  }
);

/* =========================================================
   CAMPAIGN GUARDRAILS
========================================================= */

app.get(
  "/api/marketing/campaigns/:id/guardrails",
  (req, res) => {
    const campaign =
      getCampaignById(
        req.params.id
      );

    if (!campaign) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "کمپین پیدا نشد.",
        });
    }

    const config =
      getCampaignRuntimeConfig(
        campaign.id
      );

    res.json({
      ok: true,

      data: {
        campaignId:
          campaign.id,

        guardrails:
          config.guardrails,
      },
    });
  }
);

app.post(
  "/api/marketing/campaigns/:id/guardrails",
  (req, res) => {
    const campaign =
      getCampaignById(
        req.params.id
      );

    if (!campaign) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "کمپین پیدا نشد.",
        });
    }

    const config =
      updateCampaignRuntimeConfig(
        campaign.id,
        {
          guardrails:
            req.body ||
            {},
        }
      );

    res.json({
      ok: true,

      data: {
        campaignId:
          campaign.id,

        guardrails:
          config.guardrails,
      },
    });
  }
);

/* =========================================================
   CAMPAIGN KPI TARGETS
========================================================= */

app.get(
  "/api/marketing/campaigns/:id/targets",
  (req, res) => {
    const campaign =
      getCampaignById(
        req.params.id
      );

    if (!campaign) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "کمپین پیدا نشد.",
        });
    }

    const config =
      getCampaignRuntimeConfig(
        campaign.id
      );

    res.json({
      ok: true,

      data: {
        campaignId:
          campaign.id,

        targets:
          config.targets,
      },
    });
  }
);

app.post(
  "/api/marketing/campaigns/:id/targets",
  (req, res) => {
    const campaign =
      getCampaignById(
        req.params.id
      );

    if (!campaign) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "کمپین پیدا نشد.",
        });
    }

    const config =
      updateCampaignRuntimeConfig(
        campaign.id,
        {
          targets:
            req.body ||
            {},
        }
      );

    res.json({
      ok: true,

      data: {
        campaignId:
          campaign.id,

        targets:
          config.targets,
      },
    });
  }
);

/* =========================================================
   TRACKING HEALTH
========================================================= */

app.post(
  "/api/marketing/campaigns/:id/tracking-status",
  (req, res) => {
    const campaign =
      getCampaignById(
        req.params.id
      );

    if (!campaign) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "کمپین پیدا نشد.",
        });
    }

    const healthy =
      req.body?.healthy !==
      false;

    const config =
      updateCampaignRuntimeConfig(
        campaign.id,
        {
          trackingHealthy:
            healthy,
        }
      );

    res.json({
      ok: true,

      data: {
        campaignId:
          campaign.id,

        trackingHealthy:
          config.trackingHealthy,
      },
    });
  }
);

/* =========================================================
   OPTIMIZATION SIMULATION
========================================================= */

app.post(
  "/api/marketing/campaigns/:id/simulate",
  (req, res) => {
    try {
      const campaign =
        getCampaignById(
          req.params.id
        );

      if (!campaign) {
        return res
          .status(404)
          .json({
            ok: false,

            message:
              "کمپین پیدا نشد.",
          });
      }

      const performance =
        getCampaignAttributedPerformance(
          campaign.id
        );

      const config =
        getCampaignRuntimeConfig(
          campaign.id
        );

      const optimization =
        optimizeCampaign({
          campaign,

          performance,

          targets:
            config.targets,

          guardrails:
            config.guardrails,

          controlMode:
            config.controlMode,

          trackingHealthy:
            config.trackingHealthy,
        });

      let recommendation =
        req.body
          ?.recommendation ||
        null;

      if (!recommendation) {
        recommendation =
          optimization
            .recommendations?.[0] ||
          null;
      }

      if (!recommendation) {
        return res
          .status(400)
          .json({
            ok: false,

            message:
              "Recommendation برای شبیه‌سازی وجود ندارد.",
          });
      }

      const simulation =
        simulateOptimization({
          performance,

          recommendation,

          confidence:
            req.body
              ?.confidence ??
            0.7,
        });

      res.json({
        ok: true,

        data: {
          campaign,

          recommendation,

          simulation,
        },
      });
    } catch (error) {
      console.error(
        "Optimization simulation error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در شبیه‌سازی Optimize.",
        });
    }
  }
);

/* =========================================================
   BUDGET REALLOCATION
========================================================= */

app.get(
  "/api/marketing/budget-reallocation",
  (req, res) => {
    try {
      const campaigns =
        getMarketingCampaigns();

      const campaignResults =
        campaigns.map(
          (campaign) => {
            const performance =
              getCampaignAttributedPerformance(
                campaign.id
              );

            const config =
              getCampaignRuntimeConfig(
                campaign.id
              );

            const optimization =
              optimizeCampaign({
                campaign,

                performance,

                targets:
                  config.targets,

                guardrails:
                  config.guardrails,

                controlMode:
                  config.controlMode,

                trackingHealthy:
                  config.trackingHealthy,
              });

            return {
              campaign,

              performance,

              optimization,
            };
          }
        );

      const recommendation =
        suggestBudgetReallocation(
          campaignResults
        );

      res.json({
        ok: true,

        data: {
          recommendation,

          campaigns:
            campaignResults,
        },
      });
    } catch (error) {
      console.error(
        "Budget reallocation error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در محاسبه تخصیص بودجه.",
        });
    }
  }
);

/* =========================================================
   MARKETING OVERVIEW
========================================================= */

app.get(
  "/api/marketing/overview",
  (req, res) => {
    try {
      const campaigns =
        getMarketingCampaigns();

      const campaignData =
        campaigns.map(
          (campaign) => {
            const metrics =
              getCampaignMetrics(
                campaign.id
              );

            const kpis =
              calculateCampaignKPIs(
                metrics
              );

            const performance =
              getCampaignAttributedPerformance(
                campaign.id
              );

            const config =
              getCampaignRuntimeConfig(
                campaign.id
              );

            const optimization =
              optimizeCampaign({
                campaign,

                performance,

                targets:
                  config.targets,

                guardrails:
                  config.guardrails,

                controlMode:
                  config.controlMode,

                trackingHealthy:
                  config.trackingHealthy,
              });

            return {
              campaign,

              kpis,

              performance,

              optimization,

              control:
                config,
            };
          }
        );

      res.json({
        ok: true,

        data: {
          campaignsCount:
            campaigns.length,

          campaigns:
            campaignData,
        },
      });
    } catch (error) {
      console.error(
        "Marketing overview error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت نمای کلی مارکتینگ.",
        });
    }
  }
);

/* =========================================================
   DATABASE STATUS
========================================================= */

app.get(
  "/api/database/status",
  (req, res) => {
    res.json({
      ok: true,

      database:
        "SQLite",

      persistent:
        true,

      customer360:
        true,

      directMessaging:
        true,

      marketing:
        true,

      attribution:
        true,

      leadConversion:
        true,

      revenueAttribution:
        true,

      campaignPlanner:
        true,

      optimizer:
        true,

      optimizationSimulation:
        true,

      controlModes:
        true,

      guardrails:
        true,

      crm:
        getCRMStats(),

      marketingChannels:
        getMarketingChannels()
          .length,

      marketingPlatforms:
        getMarketingPlatforms()
          .length,

      marketingCampaigns:
        getMarketingCampaigns()
          .length,

      automations:
        getAutomations()
          .length,

      executions:
        getExecutions(
          1000
        ).length,

      optimizerCapabilities:
        getOptimizerCapabilities(),
    });
  }
);

/* =========================================================
   MESSAGING STATUS
========================================================= */

app.get(
  "/api/messaging/status",
  (req, res) => {
    try {
      res.json({
        ok: true,

        data:
          getMessagingStatus(),
      });
    } catch (error) {
      console.error(
        "Messaging status error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت وضعیت پیام‌رسانی.",
        });
    }
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res
      .status(404)
      .json({
        ok: false,

        message:
          "API route not found",
      });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  environment.apiHost,
  () => {
    console.log("");

    console.log(
      "=========================================="
    );

    console.log(
      "Loadder API (canonical backend)"
    );

    console.log(
      `http://${environment.apiHost}:${PORT}`
    );

    console.log(
      "Database: SQLite"
    );

    console.log(
      "Persistence: ENABLED"
    );

    console.log(
      "Customer 360: READY"
    );

    console.log(
      "Direct Messaging: READY"
    );

    console.log(
      "Marketing Acquisition: READY"
    );

    console.log(
      "Marketing KPI Engine: READY"
    );

    console.log(
      "Attribution Engine: READY"
    );

    console.log(
      "Lead Auto Attribution: READY"
    );

    console.log(
      "Lead Conversion: READY"
    );

    console.log(
      "Order Attribution: READY"
    );

    console.log(
      "Revenue Attribution: READY"
    );

    console.log(
      "Real ROAS Engine: READY"
    );

    console.log(
      "AI Campaign Planner: READY"
    );

    console.log(
      "Campaign Scenarios: READY"
    );

    console.log(
      "AI Optimizer: READY"
    );

    console.log(
      "Waste Detection: READY"
    );

    console.log(
      "Optimization Simulation: READY"
    );

    console.log(
      "Budget Reallocation: READY"
    );

    console.log(
      "Manual Mode: READY"
    );

    console.log(
      "Co-Pilot Mode: READY"
    );

    console.log(
      "Auto-Pilot Mode: READY"
    );

    console.log(
      "Campaign Guardrails: READY"
    );

    console.log(
      "Workflow Engine: READY"
    );

    console.log(
      "Messaging Adapter: READY"
    );

    console.log(
      "=========================================="
    );

    console.log("");
  }
);
