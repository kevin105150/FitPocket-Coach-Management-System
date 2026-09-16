import React from 'react';
import Layout from '../components/Layout';
import StudentDashboard from '../components/StudentDashboard';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function StudentPage() {
  const { user, profile, loading } = useAuth();

  // Show loading spinner while authenticating
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" />;

  return (
    <Layout user={user} profile={profile}>
      <StudentDashboard profile={profile} user={user} />
    </Layout>
  );
}
