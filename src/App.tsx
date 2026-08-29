import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DemoModePreserver from "./components/DemoModePreserver";
import { AuthProvider, RequireAuth } from "./lib/auth";
const HomePage = lazy(() => import("./pages/HomePage"));
const OriginalLandingPage = lazy(() => import("./pages/OriginalLandingPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const BrandBookPage = lazy(() => import("./pages/BrandBookPage"));
const BusinessProposalPage = lazy(() => import("./pages/BusinessProposalPage"));
const ContentStudioPage = lazy(() => import("./pages/ContentStudioPage"));
const SocialManagerPage = lazy(() => import("./pages/SocialManagerPage"));
const AdsCenterPage = lazy(() => import("./pages/AdsCenterWithGoogleEntryPage"));
const GoogleAdsSearchWizardPage = lazy(() => import("./pages/GoogleAdsConnectedWizardPage"));
const MarketingPage = lazy(() => import("./pages/MarketingPage"));
const CRMPage = lazy(() => import("./pages/CRMPage"));
const CustomerProfilePage = lazy(() => import("./pages/CustomerProfilePage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const KPIPage = lazy(() => import("./pages/KPIPage"));
const PredictivePage = lazy(() => import("./pages/PredictivePage"));
const AutomationPage = lazy(() => import("./pages/AutomationPage"));
const BusinessBrainPage = lazy(() => import("./pages/BusinessBrainPage"));
const ClickTestPage = lazy(() => import("./pages/ClickTestPage"));
const IntelligencePreviewPage = lazy(() => import("./pages/IntelligencePreviewPage"));
const NativeSiteBuilderPage = lazy(() => import("./pages/NativeSiteBuilderPage"));
const SiteProjectStudioPage = lazy(() => import("./pages/SiteProjectStudioPage"));
const SiteOperationsDashboardPage = lazy(() => import("./pages/SiteOperationsDashboardPage"));
export default function App() {
  return <BrowserRouter><AuthProvider><DemoModePreserver /><Suspense fallback={null}><Routes>
    <Route path="/" element={<OriginalLandingPage />} /><Route path="/signup" element={<AuthPage />} />
    <Route element={<RequireAuth />}>
      <Route path="/dashboard" element={<DashboardPage />} /><Route path="/legacy-dashboard" element={<HomePage />} />
      <Route path="/dashboard/brand-book" element={<BrandBookPage />} /><Route path="/dashboard/business-proposal" element={<BusinessProposalPage />} />
      <Route path="/dashboard/content" element={<ContentStudioPage />} /><Route path="/dashboard/social" element={<SocialManagerPage />} />
      <Route path="/dashboard/ads" element={<AdsCenterPage />} /><Route path="/dashboard/ads/google" element={<GoogleAdsSearchWizardPage />} /><Route path="/dashboard/marketing" element={<MarketingPage />} />
      <Route path="/dashboard/crm" element={<CRMPage />} /><Route path="/dashboard/crm/customer/:id" element={<CustomerProfilePage />} />
      <Route path="/dashboard/analytics" element={<AnalyticsPage />} /><Route path="/dashboard/kpi" element={<KPIPage />} />
      <Route path="/dashboard/predictive" element={<PredictivePage />} /><Route path="/dashboard/automation" element={<AutomationPage />} />
      <Route path="/dashboard/business-brain" element={<BusinessBrainPage />} /><Route path="/dashboard/websites" element={<SiteProjectStudioPage />} />
      <Route path="/dashboard/websites/ai" element={<NativeSiteBuilderPage />} /><Route path="/dashboard/websites/new" element={<SiteProjectStudioPage />} /><Route path="/dashboard/site-operations" element={<SiteOperationsDashboardPage />} />
      <Route path="/site-builder" element={<SiteProjectStudioPage />} /><Route path="/click-test" element={<ClickTestPage />} /><Route path="/intelligence" element={<IntelligencePreviewPage />} />
    </Route><Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></Suspense></AuthProvider></BrowserRouter>;
}
