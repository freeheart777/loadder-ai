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

const HomePage = lazy(() => import("./pages/HomePage"));
const OriginalLandingPage = lazy(() => import("./pages/OriginalLandingPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const BrandBookPage = lazy(() => import("./pages/BrandBookPage"));
const BusinessProposalPage = lazy(() => import("./pages/BusinessProposalPage"));
const ContentStudioPage = lazy(() => import("./pages/ContentStudioPage"));
const SocialManagerPage = lazy(() => import("./pages/SocialManagerPage"));
const AdsCenterPage = lazy(() => import("./pages/AdsCenterPage"));
const MarketingPage = lazy(() => import("./pages/MarketingPage"));
const CRMPage = lazy(() => import("./pages/CRMPage"));
const CustomerProfilePage = lazy(() => import("./pages/CustomerProfilePage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const KPIPage = lazy(() => import("./pages/KPIPage"));
const PredictivePage = lazy(() => import("./pages/PredictivePage"));
const AutomationPage = lazy(() => import("./pages/AutomationPage"));
const BusinessBrainPage = lazy(() => import("./pages/BusinessBrainPage"));
const ClickTestPage = lazy(() => import("./pages/ClickTestPage"));

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

        {/* داشبورد قدیمی - فقط برای بکاپ */}
        <Route
          path="/legacy-dashboard"
          element={<HomePage />}
        />

        {/* برند بوک */}
        <Route
          path="/dashboard/brand-book"
          element={<BrandBookPage />}
        />

        {/* بیزنس پروپوزال */}
        <Route
          path="/dashboard/business-proposal"
          element={<BusinessProposalPage />}
        />

        {/* استودیوی تولید محتوا */}
        <Route
          path="/dashboard/content"
          element={<ContentStudioPage />}
        />

        {/* مدیریت شبکه‌های اجتماعی */}
        <Route
          path="/dashboard/social"
          element={<SocialManagerPage />}
        />

        {/* مرکز تبلیغات */}
        <Route
          path="/dashboard/ads"
          element={<AdsCenterPage />}
        />

        {/* مرکز فرماندهی مارکتینگ */}
        <Route
          path="/dashboard/marketing"
          element={<MarketingPage />}
        />

        {/* ارتباط با مشتری */}
        <Route
          path="/dashboard/crm"
          element={<CRMPage />}
        />

        {/* پروفایل 360 مشتری */}
        <Route
          path="/dashboard/crm/customer/:id"
          element={<CustomerProfilePage />}
        />

        {/* تحلیل و گزارش */}
        <Route
          path="/dashboard/analytics"
          element={<AnalyticsPage />}
        />

        {/* مرکز سنجش عملکرد */}
        <Route
          path="/dashboard/kpi"
          element={<KPIPage />}
        />

        {/* پیش‌بینی آینده */}
        <Route
          path="/dashboard/predictive"
          element={<PredictivePage />}
        />

        {/* اتوماسیون */}
        <Route
          path="/dashboard/automation"
          element={<AutomationPage />}
        />

        {/* مغز هوشمند کسب‌وکار */}
        <Route
          path="/dashboard/business-brain"
          element={<BusinessBrainPage />}
        />

        {/* هر مسیر اشتباه برگردد به داشبورد */}

            <Route
              path="/click-test"
              element={<ClickTestPage />}
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
