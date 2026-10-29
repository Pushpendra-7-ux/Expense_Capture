import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RoleProvider } from './context/RoleContext';
import { EmployeeLayout } from './components/employee/EmployeeLayout';
import { FinanceLayout } from './components/finance/FinanceLayout';
import { RoleSelectPage } from './pages/role-select/RoleSelectPage';
import { EmployeeFeedPage } from './pages/employee/EmployeeFeedPage';
import { EmployeeSnapPage } from './pages/employee/EmployeeSnapPage';
import { EmployeeNoBillPage } from './pages/employee/EmployeeNoBillPage';
import { EmployeeReviewPage } from './pages/employee/EmployeeReviewPage';
import { EmployeeConfirmationPage } from './pages/employee/EmployeeConfirmationPage';
import { EmployeeExpenseDetailPage } from './pages/employee/EmployeeExpenseDetailPage';
import { EmployeeAnalyticsPage } from './pages/employee/EmployeeAnalyticsPage';
import { FinanceClaimsPage } from './pages/finance/FinanceClaimsPage';
import { FinanceClaimDetailPage } from './pages/finance/FinanceClaimDetailPage';
import { FinanceAnalyticsPage } from './pages/finance/FinanceAnalyticsPage';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <RoleProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RoleSelectPage />} />

        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index element={<EmployeeFeedPage />} />
          <Route path="analytics" element={<EmployeeAnalyticsPage />} />
          <Route path="snap" element={<EmployeeSnapPage />} />
          <Route path="no-bill" element={<EmployeeNoBillPage />} />
          <Route path="review" element={<EmployeeReviewPage />} />
          <Route path="confirmation" element={<EmployeeConfirmationPage />} />
          <Route path="expenses/:id" element={<EmployeeExpenseDetailPage />} />
        </Route>

        <Route path="/finance" element={<FinanceLayout />}>
          <Route index element={<FinanceClaimsPage />} />
          <Route path="claims/:id" element={<FinanceClaimDetailPage />} />
          <Route path="analytics" element={<FinanceAnalyticsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RoleProvider>
  );
}
