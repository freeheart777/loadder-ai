import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DemoModePreserver from "./components/DemoModePreserver";
import { AuthProvider, RequireAuth } from "./lib/auth";

const StoreWebsiteStudioPageV16 = lazy(() => import("./pages/StoreWebsiteStudioPageV16"));
const PublicBusinessAppPage = lazy(() => import("./pages/PublicBusinessAppPage"));
const StoreFinancialsPage = lazy(() => import("./pages/StoreFinancialsPage"));
const BusinessBuilderPage = lazy(() => import("./pages/BusinessBuilderPage"));
const BusinessBuilderOperationsPage = lazy(() => import("./pages/BusinessBuilderOperationsPage"));
const BusinessBuilderAdminPage = lazy(() => import("./pages/BusinessBuilderAdminPage"));
const BusinessBuilderIntegrationsPage = lazy(() => import("./pages/BusinessBuilderIntegrationsPage"));
const GeneratedBusinessAppPage = lazy(() => import("./pages/GeneratedBusinessAppPage"));
const CRMSalesPipelinePage = lazy(() => import("./pages/CRMSalesPipelinePage"));
const HomePage = lazy(() => import("./pages/HomePage")),
  OriginalLandingPage = lazy(() => import("./pages/OriginalLandingPage")),
  DashboardPage = lazy(() => import("./pages/DashboardPage")),
  AuthPage = lazy(() => import("./pages/AuthPage")),
  BrandBookPage = lazy(() => import("./pages/BrandBookPage")),
  BusinessProposalPage = lazy(() => import("./pages/BusinessProposalPage")),
  ContentStudioPage = lazy(() => import("./pages/ContentStudioPage")),
  SocialManagerPage = lazy(() => import("./pages/SocialManagerPage")),
  AdsCenterPage = lazy(() => import("./pages/AdsCenterWithGoogleEntryPage")),
  GoogleAdsSearchWizardPage = lazy(() => import("./pages/GoogleAdsConnectedWizardPage")),
  MarketingPage = lazy(() => import("./pages/MarketingPage")),
  CRMPage = lazy(() => import("./pages/CRMPage")),
  CustomerProfilePage = lazy(() => import("./pages/CustomerProfilePage")),
  AnalyticsPage = lazy(() => import("./pages/AnalyticsPage")),
  KPIPage = lazy(() => import("./pages/KPIPage")),
  PredictivePage = lazy(() => import("./pages/PredictivePage")),
  AutomationPage = lazy(() => import("./pages/AutomationPage")),
  BusinessBrainPage = lazy(() => import("./pages/BusinessBrainPage")),
  ClickTestPage = lazy(() => import("./pages/ClickTestPage")),
  IntelligencePreviewPage = lazy(() => import("./pages/IntelligencePreviewPage")),
  StoreSetupWizardPage = lazy(() => import("./pages/StoreSetupWizardPage")),
  StoreAdminDashboardPage = lazy(() => import("./pages/StoreAdminDashboardPage")),
  StoreCommerceManagerPage = lazy(() => import("./pages/StoreCommerceManagerPage")),
  StoreCatalogOperationsPage = lazy(() => import("./pages/StoreCatalogOperationsPage")),
  StoreProductDetailPage = lazy(() => import("./pages/StoreProductDetailPage")),
  StorefrontTestPage = lazy(() => import("./pages/StorefrontTestPage")),
  PublicStorefrontPage = lazy(() => import("./pages/PublicStorefrontPage")),
  PublicProductPage = lazy(() => import("./pages/PublicProductPage")),
  PublicCartPage = lazy(() => import("./pages/PublicCartPage")),
  PublicCheckoutPage = lazy(() => import("./pages/PublicCheckoutPage")),
  PublicOrderSuccessPage = lazy(() => import("./pages/PublicOrderSuccessPage")),
  SiteOperationsDashboardPage = lazy(() => import("./pages/SiteOperationsDashboardPage"));

const canonicalBuilder = <Navigate to="/dashboard/websites" replace />;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DemoModePreserver />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<OriginalLandingPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="/app/:projectId" element={<PublicBusinessAppPage />} />
            <Route path="/store/:siteProjectId" element={<PublicStorefrontPage />} />
            <Route path="/store/:siteProjectId/product/:slug" element={<PublicProductPage />} />
            <Route path="/store/:siteProjectId/cart" element={<PublicCartPage />} />
            <Route path="/store/:siteProjectId/checkout" element={<PublicCheckoutPage />} />
            <Route path="/store/:siteProjectId/order-success/:orderId" element={<PublicOrderSuccessPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/legacy-dashboard" element={<HomePage />} />
              <Route path="/dashboard/brand-book" element={<BrandBookPage />} />
              <Route path="/dashboard/business-proposal" element={<BusinessProposalPage />} />
              <Route path="/dashboard/content" element={<ContentStudioPage />} />
              <Route path="/dashboard/social" element={<SocialManagerPage />} />
              <Route path="/dashboard/ads" element={<AdsCenterPage />} />
              <Route path="/dashboard/ads/google" element={<GoogleAdsSearchWizardPage />} />
              <Route path="/dashboard/marketing" element={<MarketingPage />} />
              <Route path="/dashboard/crm" element={<CRMPage />} />
              <Route path="/dashboard/crm/pipeline" element={<CRMSalesPipelinePage />} />
              <Route path="/dashboard/crm/customer/:id" element={<CustomerProfilePage />} />
              <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
              <Route path="/dashboard/kpi" element={<KPIPage />} />
              <Route path="/dashboard/predictive" element={<PredictivePage />} />
              <Route path="/dashboard/automation" element={<AutomationPage />} />
              <Route path="/dashboard/business-brain" element={<BusinessBrainPage />} />
              <Route path="/dashboard/business-builder" element={<BusinessBuilderPage />} />
              <Route path="/dashboard/business-builder/operations" element={<BusinessBuilderOperationsPage />} />
              <Route path="/dashboard/business-builder/admin" element={<BusinessBuilderAdminPage />} />
              <Route path="/dashboard/business-builder/integrations" element={<BusinessBuilderIntegrationsPage />} />
              <Route path="/dashboard/business-builder/apps/:projectId" element={<GeneratedBusinessAppPage />} />

              <Route path="/dashboard/websites" element={<StoreWebsiteStudioPageV16 />} />
              <Route path="/dashboard/websites/setup" element={<StoreSetupWizardPage />} />
              <Route path="/dashboard/websites/admin" element={<StoreAdminDashboardPage />} />
              <Route path="/dashboard/websites/commerce" element={<StoreCommerceManagerPage />} />
              <Route path="/dashboard/websites/commerce/operations" element={<StoreCatalogOperationsPage />} />
              <Route path="/dashboard/websites/commerce/financials" element={<StoreFinancialsPage />} />
              <Route path="/dashboard/websites/commerce/product/:id" element={<StoreProductDetailPage />} />
              <Route path="/dashboard/websites/storefront-test" element={<StorefrontTestPage />} />

              <Route path="/dashboard/websites/quick-start" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio" element={canonicalBuilder} />
              <Route path="/dashboard/websites/store-v1" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v2" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v3" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v4" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v5" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v6" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v7" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v8" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v9" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v10" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v11" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v12" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v13" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v14" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v15" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-v16" element={canonicalBuilder} />
              <Route path="/dashboard/websites/fallback/v13" element={canonicalBuilder} />
              <Route path="/dashboard/websites/fallback/v14" element={canonicalBuilder} />
              <Route path="/dashboard/websites/fallback/v15" element={canonicalBuilder} />
              <Route path="/dashboard/websites/studio-legacy" element={canonicalBuilder} />
              <Route path="/dashboard/websites/ai" element={canonicalBuilder} />
              <Route path="/dashboard/websites/new" element={canonicalBuilder} />
              <Route path="/site-builder" element={canonicalBuilder} />
              <Route path="/site-builder/legacy" element={canonicalBuilder} />

              <Route path="/dashboard/site-operations" element={<SiteOperationsDashboardPage />} />
              <Route path="/click-test" element={<ClickTestPage />} />
              <Route path="/intelligence" element={<IntelligencePreviewPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
