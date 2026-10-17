import { Route, Routes } from 'react-router-dom';
import PublicLayout from './components/layout/PublicLayout.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import { RequireAuth, RequireRole } from './components/layout/guards.jsx';

import Home from './pages/public/Home.jsx';
import Vacancies from './pages/public/Vacancies.jsx';
import VacancyDetail from './pages/public/VacancyDetail.jsx';
import Login from './pages/public/Login.jsx';
import Register from './pages/public/Register.jsx';
import NotFound from './pages/public/NotFound.jsx';
import VerifyEmail from './pages/public/VerifyEmail.jsx';

import Dashboard from './pages/portal/Dashboard.jsx';
import Notifications from './pages/portal/Notifications.jsx';
import Account from './pages/portal/Account.jsx';
import Interviews from './pages/portal/Interviews.jsx';

import Profile from './pages/applicant/Profile.jsx';
import Apply from './pages/applicant/Apply.jsx';
import MyApplications from './pages/applicant/MyApplications.jsx';
import ApplicationView from './pages/applicant/ApplicationView.jsx';

import VacancyList from './pages/staff/VacancyList.jsx';
import VacancyForm from './pages/staff/VacancyForm.jsx';
import VacancyManage from './pages/staff/VacancyManage.jsx';
import ApplicationList from './pages/staff/ApplicationList.jsx';
import ApplicationReview from './pages/staff/ApplicationReview.jsx';
import Reports from './pages/staff/Reports.jsx';

import Pipeline from './pages/staff/Pipeline.jsx';
import Users from './pages/admin/Users.jsx';
import Departments from './pages/admin/Departments.jsx';
import AuditLogs from './pages/admin/AuditLogs.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/vacancies" element={<Vacancies />} />
        <Route path="/vacancies/:id" element={<VacancyDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/portal" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="account" element={<Account />} />

          <Route element={<RequireRole roles={['applicant', 'hr_officer', 'department_head']} />}>
            <Route path="interviews" element={<Interviews />} />
          </Route>

          <Route element={<RequireRole roles={['applicant']} />}>
            <Route path="profile" element={<Profile />} />
            <Route path="applications" element={<MyApplications />} />
            <Route path="applications/:id" element={<ApplicationView />} />
            <Route path="apply/:vacancyId" element={<Apply />} />
          </Route>

          <Route element={<RequireRole roles={['hr_officer', 'department_head']} />}>
            <Route path="manage/applications" element={<ApplicationList />} />
            <Route path="manage/applications/:id" element={<ApplicationReview />} />
            <Route path="manage/pipeline" element={<Pipeline />} />
          </Route>

          <Route element={<RequireRole roles={['hr_officer', 'admin']} />}>
            <Route path="manage/vacancies" element={<VacancyList />} />
            <Route path="manage/vacancies/:id" element={<VacancyManage />} />
            <Route path="reports" element={<Reports />} />
          </Route>

          <Route element={<RequireRole roles={['hr_officer']} />}>
            <Route path="manage/vacancies/new" element={<VacancyForm />} />
            <Route path="manage/vacancies/:id/edit" element={<VacancyForm />} />
          </Route>

          <Route element={<RequireRole roles={['admin']} />}>
            <Route path="users" element={<Users />} />
            <Route path="departments" element={<Departments />} />
            <Route path="audit" element={<AuditLogs />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
