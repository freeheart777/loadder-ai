import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import DemoModePreserver from "./components/DemoModePreserver";
import { AuthProvider, RequireAuth } from "./lib/auth";

import HomePage from "./pages/HomePage";
import PresentationHomePage from "./pages/PresentationHomePage";
import OriginalLandingPage from "./pages/OriginalLandingPage";
import DashboardPage from "./pages/DashboardPage";
import AuthPage from "./pages/AuthPage";

import BrandBookPage from "./pages/BrandBookPage";
import BusinessProposalPage from "./pages/BusinessProposalPage";

import ContentStudioPage from "./pages/ContentStudioPage";
import SocialManagerPage from "./pages/SocialManagerPage";

import AdsCenterPage from "./pages/AdsCenterPage";
import MarketingPage from "./pages/MarketingPage";

import CRMPage from "./pages/CRMPage";
import CustomerProfilePage from "./pages/CustomerProfilePage";

import AnalyticsPage from "./pages/AnalyticsPage";
import KPIPage from "./pages/KPIPage";
import PredictivePage from "./pages/PredictivePage";

import AutomationPage from "./pages/AutomationPage";

import BusinessBrainPage from "./pages/BusinessBrainPage";

import ClickTestPage from "./pages/ClickTestPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DemoModePreserver />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
