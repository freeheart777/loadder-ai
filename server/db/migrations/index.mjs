import { migration001Identity } from "./001_identity.mjs";
import { migration002TenantDomainData } from "./002_tenant_domain_data.mjs";
import { migration003TenantRelationshipGuards } from "./003_tenant_relationship_guards.mjs";
import { migration004WorkspaceManagementAudit } from "./004_workspace_management_audit.mjs";
import { migration005BusinessProfiles } from "./005_business_profiles.mjs";
import { migration006BusinessDnaVersions } from "./006_business_dna_versions.mjs";
import { migration007BusinessDnaImmutability } from "./007_business_dna_immutability.mjs";
import { migration008BrandBookVersions } from "./008_brand_book_versions.mjs";
import { migration009BrandBookImmutability } from "./009_brand_book_immutability.mjs";
import { migration010BusinessContextVersions } from "./010_business_context_versions.mjs";
import { migration011BusinessContextImmutability } from "./011_business_context_immutability.mjs";
import { migration012BusinessContextLifecycleGuards } from "./012_business_context_lifecycle_guards.mjs";
import { migration013BusinessContextUsage } from "./013_business_context_usage.mjs";
import { migration014BusinessEventsObservationsSignals } from "./014_business_events_observations_signals.mjs";
import { migration015IntelligenceDataGuards } from "./015_intelligence_data_guards.mjs";
import { migration016FeatureValues } from "./016_feature_values.mjs";
import { migration017FeatureValueGuards } from "./017_feature_value_guards.mjs";
import { migration018ModelInputSnapshots } from "./018_model_input_snapshots.mjs";
import { migration019Evaluations } from "./019_evaluations.mjs";
import { migration020ModelEvaluationGuards } from "./020_model_evaluation_guards.mjs";
import { migration021ForecastRecords } from "./021_forecast_records.mjs";
import { migration022IntegrationFoundation } from "./022_integration_foundation.mjs";
import { migration023KnowledgeKpiFoundation } from "./023_knowledge_kpi_foundation.mjs";
import { migration024ForecastIntegrationGuards } from "./024_forecast_integration_guards.mjs";
import { migration025KnowledgeCandidates } from "./025_knowledge_candidates.mjs";
import { migration026ParsingExtraction } from "./026_parsing_extraction.mjs";
import { migration027FieldCandidatesReviews } from "./027_field_candidates_reviews.mjs";
import { migration028ImportedFactEventMapping } from "./028_imported_fact_event_mapping.mjs";
import { migration029Phase4bGuards } from "./029_phase4b_guards.mjs";
import { migration030ListeningMonitors } from "./030_listening_monitors.mjs";
import { migration031ListeningCollectionRecords } from "./031_listening_collection_records.mjs";
import { migration032ListeningEventLinks } from "./032_listening_event_links.mjs";
import { migration033ListeningGuards } from "./033_listening_guards.mjs";
import { migration034ListeningIntelligence } from "./034_listening_intelligence.mjs";
import { migration035SemanticFindings } from "./035_semantic_findings.mjs";
import { migration036IntelligenceRecommendations } from "./036_intelligence_recommendations.mjs";
import { migration037HumanGovernance } from "./037_human_governance.mjs";
import { migration038ActionProposals } from "./038_action_proposals.mjs";
import { migration039ExecutionAuthorizations } from "./039_execution_authorizations.mjs";
import { migration040ExecutionRequests } from "./040_execution_requests.mjs";
import { providerAccountIdentitiesMigration } from "./041_provider_account_identities.mjs";
import { migration042ExecutionAttemptResultLedger } from "./042_execution_attempt_result_ledger.mjs";
import { migration043ExecutionDispatchJobs } from "./043_execution_dispatch_jobs.mjs";
import { migration044ExecutionActionInputs } from "./044_execution_action_inputs.mjs";
import { migration045ContentGenerations } from "./045_content_generations.mjs";
import { migration046ExecutionDispatchJobTenantPollIndexes } from "./046_execution_dispatch_job_tenant_poll_indexes.mjs";
import { migration047ContentItems } from "./047_content_items.mjs";
import { migration048ContentItemSourceIdentity } from "./048_content_item_source_identity.mjs";
import { migration049ContentAssets } from "./049_content_assets.mjs";
import { migration050RealAssetUpload } from "./050_real_asset_upload.mjs";
import { migration051UploadedCreativeLinkage } from "./051_uploaded_creative_linkage.mjs";
import { migration052CreativePlacements } from "./052_creative_placements.mjs";
import { migration053CreativeIntents } from "./053_creative_intents.mjs";
import { migration054DistributionContexts } from "./054_distribution_contexts.mjs";
import { migration055AttributionTouches } from "./055_attribution_touches.mjs";
import { migration056PerformanceObservations } from "./056_performance_observations.mjs";
import { migration057LandingBuilderCore } from "./057_landing_builder_core.mjs";
import { migration058WebsiteBuilderFoundation } from "./058_website_builder_foundation.mjs";
import { migration059CommerceCatalogFoundation } from "./059_commerce_catalog_foundation.mjs";
import { migration060CartCheckoutFoundation } from "./060_cart_checkout_foundation.mjs";
import { migration061PaymentOrderLifecycle } from "./061_payment_order_lifecycle.mjs";
import { migration062InventoryFulfillmentFoundation } from "./062_inventory_fulfillment_foundation.mjs";
import { migration063ReturnRefundLifecycle } from "./063_return_refund_lifecycle.mjs";
import { migration064CustomDomainPublishing } from "./064_custom_domain_publishing.mjs";

export const migrations = [
  migration001Identity,
  migration002TenantDomainData,
  migration003TenantRelationshipGuards,
  migration004WorkspaceManagementAudit,
  migration005BusinessProfiles,
  migration006BusinessDnaVersions,
  migration007BusinessDnaImmutability,
  migration008BrandBookVersions,
  migration009BrandBookImmutability,
  migration010BusinessContextVersions,
  migration011BusinessContextImmutability,
  migration012BusinessContextLifecycleGuards,
  migration013BusinessContextUsage,
  migration014BusinessEventsObservationsSignals,
  migration015IntelligenceDataGuards,
  migration016FeatureValues,
  migration017FeatureValueGuards,
  migration018ModelInputSnapshots,
  migration019Evaluations,
  migration020ModelEvaluationGuards,
  migration021ForecastRecords,
  migration022IntegrationFoundation,
  migration023KnowledgeKpiFoundation,
  migration024ForecastIntegrationGuards,
  migration025KnowledgeCandidates,
  migration026ParsingExtraction,
  migration027FieldCandidatesReviews,
  migration028ImportedFactEventMapping,
  migration029Phase4bGuards,
  migration030ListeningMonitors,
  migration031ListeningCollectionRecords,
  migration032ListeningEventLinks,
  migration033ListeningGuards,
  migration034ListeningIntelligence,
  migration035SemanticFindings,
  migration036IntelligenceRecommendations,
  migration037HumanGovernance,
  migration038ActionProposals,
  migration039ExecutionAuthorizations,
  migration040ExecutionRequests,
  providerAccountIdentitiesMigration,
  migration042ExecutionAttemptResultLedger,
  migration043ExecutionDispatchJobs,
  migration044ExecutionActionInputs,
  migration045ContentGenerations,
  migration046ExecutionDispatchJobTenantPollIndexes,
  migration047ContentItems,
  migration048ContentItemSourceIdentity,
  migration049ContentAssets,
  migration050RealAssetUpload,
  migration051UploadedCreativeLinkage,
  migration052CreativePlacements,
  migration053CreativeIntents,
  migration054DistributionContexts,
  migration055AttributionTouches,
  migration056PerformanceObservations,
  migration057LandingBuilderCore,
  migration058WebsiteBuilderFoundation,
  migration059CommerceCatalogFoundation,
  migration060CartCheckoutFoundation,
  migration061PaymentOrderLifecycle,
  migration062InventoryFulfillmentFoundation,
  migration063ReturnRefundLifecycle,
  migration064CustomDomainPublishing,
];
