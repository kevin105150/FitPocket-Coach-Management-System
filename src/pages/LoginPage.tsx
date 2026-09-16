import React, { useState } from 'react';
import { auth, googleProvider, db } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ShieldCheck, GraduationCap, Users, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (targetRole: 'student' | 'coach') => {
    if (user) {
      // If already logged in, just navigate
      navigate(targetRole === 'student' ? '/student' : '/coach');
      return;
    }

    setIsLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const loggedUser = result.user;
      
      // Fire-and-forget profile creation to avoid blocking navigation
      const userRef = doc(db, 'users', loggedUser.uid);
      setDoc(userRef, {
        uid: loggedUser.uid,
        email: loggedUser.email || '',
        name: loggedUser.displayName || 'New User',
        lastLogin: serverTimestamp(),
      }, { merge: true }).catch(err => console.error("Profile sync error:", err));
      
      navigate(targetRole === 'student' ? '/student' : '/coach');
    } catch (error) {
      console.error('Login failed:', error);
      setIsLoggingIn(false);
    }
  };

  // Show a clean loading state to prevent UI flashing during auth check or redirect
  if ((loading && !user) || isLoggingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-indigo-200 shadow-2xl animate-pulse">
          <ShieldCheck className="w-10 h-10 text-white" />
        </div>
        <div className="flex items-center gap-2 text-indigo-600 font-bold">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>正在引導您進入系統...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="space-y-2">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-indigo-200 shadow-2xl mb-4">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">FitPocket</h1>
          <p className="text-slate-500 font-medium">智慧健康管家</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">點擊身分直接進入</p>
          
          <button
            onClick={() => handleLogin('student')}
            disabled={isLoggingIn}
            className="group p-6 rounded-3xl border-2 border-slate-100 bg-slate-50 hover:border-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-6 text-left active:scale-95"
          >
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <GraduationCap className="w-8 h-8 text-indigo-600 group-hover:text-white" />
            </div>
            <div>
              <span className="block text-lg font-black text-slate-900">我是學生</span>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">上傳並查看我的週報</span>
            </div>
          </button>

          <button
            onClick={() => handleLogin('coach')}
            disabled={isLoggingIn}
            className="group p-6 rounded-3xl border-2 border-slate-100 bg-slate-50 hover:border-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-6 text-left active:scale-95"
          >
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Users className="w-8 h-8 text-indigo-600 group-hover:text-white" />
            </div>
            <div>
              <span className="block text-lg font-black text-slate-900">我是教練</span>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">管理學生並查看網頁報告</span>
            </div>
          </button>
        </div>
        
        {user && (
          <div className="pt-4 border-t border-slate-50">
             <p className="text-sm font-medium text-slate-400">目前登入：{user.email}</p>
          </div>
        )}
      </div>
    </div>
  );
}

