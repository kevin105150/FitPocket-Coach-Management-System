import React from 'react';
import { LogOut, ShieldCheck, GraduationCap, Users } from 'lucide-react';
import { User } from 'firebase/auth';
import { UserProfile } from '../hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate, Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  user: User;
  profile: UserProfile | null;
  children: React.ReactNode;
}

export default function Layout({ user, children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isCoachView = location.pathname === '/coach';

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const toggleRole = () => {
    navigate(isCoachView ? '/student' : '/coach');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-black text-slate-900">FitPocket</span>
            </Link>
            
            <div className="flex items-center gap-4">
              <button
                onClick={toggleRole}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-sm"
              >
                {isCoachView ? <GraduationCap className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                <span className="hidden sm:inline">切換為{isCoachView ? '學生' : '教練'}</span>
                <span className="sm:hidden">{isCoachView ? '學生' : '教練'}</span>
              </button>
              
              <div className="h-8 w-px bg-slate-100 mx-2 hidden sm:block" />
              
              <div className="flex items-center gap-3 bg-slate-50 py-1.5 pl-1.5 pr-3 rounded-full border border-slate-100">
                <img
                  src={user.photoURL || ''}
                  alt={user.displayName || ''}
                  className="w-8 h-8 rounded-full shadow-sm"
                />
                <div className="hidden md:block">
                  <p className="text-sm font-bold text-slate-900 leading-none">
                    {user.displayName}
                  </p>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter mt-0.5">
                    {isCoachView ? '教練模式' : '學生模式'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 hover:bg-white rounded-full text-slate-400 hover:text-rose-500 transition-all ml-1 shadow-sm border border-transparent hover:border-slate-100"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

