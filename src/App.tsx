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
import { internalToolsEnabled } from "./lib/productPolicy";

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
const LandingBuilderPage = lazy(() => import("./pages/LandingBuilderPage"));
const WebsiteBuilderPage = lazy(() => import("./pages/WebsiteBuilderPage"));
const CommerceCatalogPage = lazy(() => import("./pages/CommerceCatalogPage"));
const CommerceCheckoutPage = lazy(() => import("./pages/CommerceCheckoutPage"));

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
        <Route path="/dashboard/websites/new" element={<WebsiteBuilderPage />} />
        <Route path="/dashboard/websites/:id/edit" element={<WebsiteBuilderPage />} />
        <Route path="/dashboard/catalog" element={<CommerceCatalogPage />} />
        <Route path="/store/cart" element={<CommerceCheckoutPage />} />

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
          element={<Navigate to="/dashboard" replace />}
        />

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
