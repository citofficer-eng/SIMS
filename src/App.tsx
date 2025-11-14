
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { ToastProvider } from './contexts/ToastContext.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';
import { VisibilityProvider } from './contexts/VisibilityContext.tsx';
import { EventProvider } from './contexts/EventContext.tsx';
import { ModalProvider } from './contexts/ModalContext.tsx';

import ProtectedRoute from './components/ProtectedRoute.tsx';
import Login from './pages/Login.tsx';
import Signup from './pages/Signup.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Leaderboard from './pages/Leaderboard.tsx';
import Events from './pages/Events.tsx';
import Profile from './pages/Profile.tsx';
import Admin from './pages/Admin.tsx';
import Layout from './components/Layout.tsx';
import { UserRole } from './types.ts';
import Rules from './pages/Rules.tsx';
import CompleteProfile from './pages/CompleteProfile.tsx';
import Teams from './pages/Teams.tsx';
import Reports from './pages/Reports.tsx';
import RealtimeTest from './pages/RealtimeTest.tsx';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <EventProvider>
              <ModalProvider>
                <VisibilityProvider>
                  <HashRouter>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/complete-profile" element={<CompleteProfile />} />
                      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="leaderboard" element={<Leaderboard />} />
                        <Route path="teams" element={<Teams />} />
                        <Route path="events" element={<Events />} />
                        <Route path="rules" element={<Rules />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="realtime-test" element={<RealtimeTest />} />
                        <Route path="profile" element={<Profile />} />
                        <Route path="profile/:userId" element={<Profile />} />
                        <Route path="admin" element={<ProtectedRoute roles={[UserRole.ADMIN]}><Admin /></ProtectedRoute>} />
                      </Route>
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  </HashRouter>
                </VisibilityProvider>
              </ModalProvider>
            </EventProvider>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;