import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ProfileSetup from './pages/ProfileSetup';
import Discover from './pages/Discover';
import Matches from './pages/Matches';
import Chat from './pages/Chat';
import VoiceCoach from './pages/VoiceCoach';
import Profile from './pages/Profile';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, userProfile } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (userProfile && (!userProfile.age || !userProfile.gender || !userProfile.interestedIn)) {
    return <Navigate to="/setup" replace />;
  }
  
  return <>{children}</>;
};

const SetupRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, userProfile } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (userProfile && userProfile.age && userProfile.gender && userProfile.interestedIn) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<SetupRoute><ProfileSetup /></SetupRoute>} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Discover />} />
            <Route path="matches" element={<Matches />} />
            <Route path="chat/:matchId" element={<Chat />} />
            <Route path="coach" element={<VoiceCoach />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
