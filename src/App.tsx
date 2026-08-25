import {
  lazy,
  Suspense,
} from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import DemoModePreserver from "./components/DemoModePreserver";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { controlledLaunchEnabled, internalToolsEnabled } from "./lib/productPolicy";

const HomePage = lazy(() => import("./pages/HomePage"));
const OriginalLandingPage = lazy(() => import("./pages/OriginalLandingPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const BrandBookPage = lazy(() => import("./pages/BrandBookPage"));
const ContentStudioPage = lazy(() => import("./pages/ContentStudioPage"));
const ContentLibraryPage = lazy(() => import("./pages/ContentLibraryPage"));
const ContentItemPage = lazy(() => import("./pages/ContentItemPage"));
const ManualContentPage = lazy(() => import("./pages/ManualContentPage"));
const BusinessBrainPage = lazy(() => import("./pages/BusinessBrainPage"));
const ClickTestPage = lazy(() => import("./pages/ClickTestPage"));
const IntelligencePreviewPage = lazy(() => import("./pages/IntelligencePreviewPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const IntentSelectionPage = lazy(() => import("./pages/IntentSelectionPage"));
const LandingBuilderPage = lazy(() => import("./pages/LandingBuilderPage"));
const WebsiteBuilderPage = lazy(() => import("./pages/WebsiteBuilderPage"));
const WebsiteContextBuilderPage = lazy(() => import("./pages/WebsiteContextBuilderPage"));
const CommerceCatalogPage = lazy(() => import("./pages/CommerceCatalogPage"));
const CommerceCheckoutPage = lazy(() => import("./pages/CommerceCheckoutPage"));
const CommercePaymentPage = lazy(() => import("./pages/CommercePaymentPage"));
const IntegrationHubPage = lazy(() => import("./pages/IntegrationHubPage"));
const DomainManagementPage = lazy(() => import("./pages/DomainManagementPage"));
const FormBuilderPage = lazy(() => import("./pages/GovernedFormBuilderPage"));
const CrmLeadsPage = lazy(() => import("./pages/CrmWorkspacePage"));
const GrowthWorkflowPage = lazy(() => import("./pages/GrowthWorkflowPage"));
const AiEconomyPage = lazy(() => import("./pages/AiEconomyPage"));
const ModelBenchmarkLabPage = lazy(() => import("./pages/ModelBenchmarkLabPage"));
const ImprovementCyclesPage = lazy(() => import("./pages/ImprovementCyclesPage"));
const ImprovementCycleDetailPage = lazy(() => import("./pages/ImprovementCycleDetailPage"));
const VisualRuntimePilotPage = lazy(() => import("./pages/internal/VisualRuntimePilotPage"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DemoModePreserver />
        <Suspense fallback={null}>
        <Routes>
        {/* صفحه اصلی Loadder */}
        <Route
          path="/"
          element={<OriginalLandingPage />}
        />

        <Route
          path="/signup"
          element={<AuthPage />}
        />

          <Route element={<RequireAuth />}>
            {/* داشبورد جدید */}
            <Route
              path="/dashboard"
              element={<DashboardPage />}
            />
            <Route
              path="/dashboard/onboarding"
              element={<OnboardingPage />}
            />
            <Route path="/dashboard/intent" element={<IntentSelectionPage />} />
            <Route path="/dashboard/growth" element={<GrowthWorkflowPage />} />

        {/* داشبورد قدیمی - فقط برای بکاپ */}
        <Route
          path="/legacy-dashboard"
          element={internalToolsEnabled ? <HomePage /> : <Navigate to="/dashboard" replace />}
        />

        {/* برند بوک */}
        <Route
          path="/dashboard/brand-book"
          element={<BrandBookPage />}
        />

        {/* بیزنس پروپوزال */}
        <Route
          path="/dashboard/business-proposal"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* استودیوی تولید محتوا */}
        <Route
          path="/dashboard/content"
          element={<ContentStudioPage />}
        />
        <Route path="/dashboard/library" element={<ContentLibraryPage />} />
        <Route path="/dashboard/library/new" element={<ManualContentPage />} />
        <Route path="/dashboard/library/:id" element={<ContentItemPage />} />
        <Route path="/dashboard/landings" element={<LandingBuilderPage />} />
        <Route path="/dashboard/landings/new" element={<LandingBuilderPage />} />
        <Route path="/dashboard/landings/:id" element={<LandingBuilderPage />} />
        <Route path="/dashboard/landings/:id/edit" element={<LandingBuilderPage />} />
        <Route path="/dashboard/websites" element={<WebsiteBuilderPage />} />
        <Route path="/dashboard/websites/new" element={<WebsiteContextBuilderPage />} />
        <Route path="/dashboard/websites/new/edit" element={<WebsiteBuilderPage />} />
        <Route path="/dashboard/websites/:id/edit" element={<WebsiteBuilderPage />} />
        <Route path="/dashboard/catalog" element={controlledLaunchEnabled ? <Navigate to="/dashboard" replace /> : <CommerceCatalogPage />} />
        <Route path="/dashboard/integrations" element={controlledLaunchEnabled ? <Navigate to="/dashboard" replace /> : <IntegrationHubPage />} />
        <Route path="/dashboard/domains" element={controlledLaunchEnabled ? <Navigate to="/dashboard" replace /> : <DomainManagementPage />} />
        <Route path="/dashboard/forms" element={<FormBuilderPage />} />
        <Route path="/store/cart" element={controlledLaunchEnabled ? <Navigate to="/dashboard" replace /> : <CommerceCheckoutPage />} />
        <Route path="/store/payment" element={controlledLaunchEnabled ? <Navigate to="/dashboard" replace /> : <CommercePaymentPage />} />

        {/* مدیریت شبکه‌های اجتماعی */}
        <Route
          path="/dashboard/social"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* مرکز تبلیغات */}
        <Route
          path="/dashboard/ads"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* مرکز فرماندهی مارکتینگ */}
        <Route
          path="/dashboard/marketing"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* ارتباط با مشتری */}
        <Route
          path="/dashboard/crm"
          element={<CrmLeadsPage />}
        />
        <Route path="/dashboard/crm/:leadId" element={<CrmLeadsPage />} />
        <Route path="/dashboard/improvement" element={<ImprovementCyclesPage />} />
        <Route path="/dashboard/improvement/:id" element={<ImprovementCycleDetailPage />} />

        {/* پروفایل 360 مشتری */}
        <Route
          path="/dashboard/crm/customer/:id"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* تحلیل و گزارش */}
        <Route
          path="/dashboard/analytics"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* مرکز سنجش عملکرد */}
        <Route
          path="/dashboard/kpi"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* پیش‌بینی آینده */}
        <Route
          path="/dashboard/predictive"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* اتوماسیون */}
        <Route
          path="/dashboard/automation"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* مغز هوشمند کسب‌وکار */}
        <Route
          path="/dashboard/business-brain"
          element={<BusinessBrainPage />}
        />

        {/* هر مسیر اشتباه برگردد به داشبورد */}

            <Route
              path="/click-test"
              element={internalToolsEnabled ? <ClickTestPage /> : <Navigate to="/dashboard" replace />}
            />
            <Route
              path="/intelligence"
              element={internalToolsEnabled ? <IntelligencePreviewPage /> : <Navigate to="/dashboard" replace />}
            />
            <Route path="/dashboard/ai-economy" element={internalToolsEnabled ? <AiEconomyPage /> : <Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/ai-economy/benchmarks" element={internalToolsEnabled ? <ModelBenchmarkLabPage /> : <Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/internal/visual-pilot" element={internalToolsEnabled ? <VisualRuntimePilotPage /> : <Navigate to="/dashboard" replace />} />
          </Route>

        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
