import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from "@react-oauth/google";
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DoctorDashboard from './pages/DoctorDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow flex flex-col">
            <Routes>
              {/* <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />

              <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
                <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
              </Route> */}

              <Route path="/" element={<AdminDashboard />} />

            </Routes>
          </main>
        </div>
      </GoogleOAuthProvider>
    </Router>
  );
}

export default App;
