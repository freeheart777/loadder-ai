import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";

import BrandBookPage from "./pages/BrandBookPage";
import BusinessProposalPage from "./pages/BusinessProposalPage";

import ContentStudioPage from "./pages/ContentStudioPage";
import SocialManagerPage from "./pages/SocialManagerPage";

import AdsCenterPage from "./pages/AdsCenterPage";

import CRMPage from "./pages/CRMPage";
import CustomerProfilePage from "./pages/CustomerProfilePage";

import AnalyticsPage from "./pages/AnalyticsPage";
import KPIPage from "./pages/KPIPage";
import PredictivePage from "./pages/PredictivePage";

import AutomationPage from "./pages/AutomationPage";

import BusinessBrainPage from "./pages/BusinessBrainPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* صفحه اصلی سایت */}
        <Route
          path="/"
          element={<HomePage />}
        />

        {/* داشبورد اصلی */}
        <Route
          path="/dashboard"
          element={<DashboardPage />}
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
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}