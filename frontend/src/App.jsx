import { Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useAuth } from './context/AuthContext.jsx';
import { useI18n } from './i18n/index.jsx';
import Layout from './components/Layout.jsx';
import { StateView } from './components/ui.jsx';
import Login from './pages/auth/Login.jsx';
import { ForgotPassword, ResetPassword } from './pages/auth/Recovery.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { CoursesPage, CourseDetail } from './pages/Courses.jsx';
import { CohortsPage, CohortDetail } from './pages/Cohorts.jsx';
import { SessionsPage, SessionDetail } from './pages/Sessions.jsx';
import { StudentsPage, StudentProfile } from './pages/Students.jsx';
import AttendancePage from './pages/Attendance.jsx';
import { AssessmentsPage, AssessmentForm, AssessmentDetail, AssessmentSubmissions } from './pages/Assessments.jsx';
import { SubmissionsPage, SubmissionDetail } from './pages/Submissions.jsx';
import ProgressPage from './pages/Progress.jsx';
import NotificationsPage from './pages/Notifications.jsx';
import ProfilePage from './pages/Profile.jsx';
import MessagesPage from './pages/Messages.jsx';

function Protected({ children }) {
  const { user, booting } = useAuth();
  const { t } = useI18n();
  if (booting) return <div className="vh-100 d-grid place-items-center d-flex justify-content-center align-items-center"><Spinner animation="border" variant="primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'instructor') return <div className="p-5"><StateView error={{ status: 403 }}>{t('common.forbidden')}</StateView></div>;
  return children;
}
const NotFound = () => <StateView error={{ status: 404 }} />;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to="/instructor/dashboard" replace />} />
      <Route path="/instructor" element={<Protected><Layout /></Protected>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="courses" element={<CoursesPage />} /><Route path="courses/:id" element={<CourseDetail />} />
        <Route path="cohorts" element={<CohortsPage />} /><Route path="cohorts/:id" element={<CohortDetail />} />
        <Route path="sessions" element={<SessionsPage />} /><Route path="sessions/:id" element={<SessionDetail />} />
        <Route path="students" element={<StudentsPage />} /><Route path="students/:id" element={<StudentProfile />} />
        <Route path="messages" element={<MessagesPage />} /><Route path="messages/:conversationId" element={<MessagesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="assessments" element={<AssessmentsPage />} /><Route path="assessments/new" element={<AssessmentForm />} />
        <Route path="assessments/:id" element={<AssessmentDetail />} /><Route path="assessments/:id/edit" element={<AssessmentForm />} />
        <Route path="assessments/:id/submissions" element={<AssessmentSubmissions />} />
        <Route path="submissions" element={<SubmissionsPage />} /><Route path="submissions/:id" element={<SubmissionDetail />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<div className="p-5"><NotFound /></div>} />
    </Routes>
  );
}
