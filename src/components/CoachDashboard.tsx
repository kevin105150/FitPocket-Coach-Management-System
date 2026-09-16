import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile } from '../hooks/useAuth';
import { Users, ChevronRight, User as UserIcon, Calendar, AlertCircle } from 'lucide-react';

interface CoachDashboardProps {
  profile: UserProfile | null;
  user: User;
}

interface Report {
  id: string;
  studentId: string;
  studentName: string;
  weekRange: string;
  htmlContent: string;
  uploadDate: any;
}

interface StudentSummary {
  id: string;
  name: string;
  latestReport: Report | null;
  reportCount: number;
}

export default function CoachDashboard({ profile, user }: CoachDashboardProps) {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null);
  const [studentReports, setStudentReports] = useState<Report[]>([]);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [iframeHeight, setIframeHeight] = useState(800);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'resize' && event.data?.height) {
        setIframeHeight(event.data.height + 60);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const injectResizeScript = (html: string) => {
    if (!html) return '';
    const script = `
      <script>
        function sendHeight() {
          window.parent.postMessage({ type: 'resize', height: document.documentElement.scrollHeight }, '*');
        }
        window.addEventListener('load', sendHeight);
        setTimeout(sendHeight, 500);
        new ResizeObserver(sendHeight).observe(document.documentElement);
      </script>
    `;
    return html + script;
  };

  useEffect(() => {
    // Fail-safe to stop loading after 8 seconds if Firestore hangs
    let timeoutId: any;
    
    const startTimeout = () => {
      timeoutId = setTimeout(() => {
        if (loading) {
          setLoading(false);
          setConnectionError(true);
        }
      }, 8000);
    };

    startTimeout();

    // Use onSnapshot for real-time updates and better error handling
    const loadData = () => {
      const q = query(collection(db, 'reports'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        clearTimeout(timeoutId); // Got data, clear timeout
        setConnectionError(false);
        try {
          const allReports = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Report));

          // Sort locally to handle documents with and without server timestamps
          allReports.sort((a, b) => {
            const timeA = a.uploadDate?.toMillis?.() || (a as any).createdAt || 0;
            const timeB = b.uploadDate?.toMillis?.() || (b as any).createdAt || 0;
            return timeB - timeA;
          });

          const studentMap = new Map<string, StudentSummary>();
          
          allReports.forEach(report => {
            if (!studentMap.has(report.studentId)) {
              studentMap.set(report.studentId, {
                id: report.studentId,
                name: report.studentName,
                latestReport: report,
                reportCount: 1
              });
            } else {
              const current = studentMap.get(report.studentId)!;
              current.reportCount += 1;
            }
          });

          setStudents(Array.from(studentMap.values()));
        } catch (error) {
          console.error('Error processing reports:', error);
        } finally {
          setLoading(false);
        }
      }, (error) => {
        clearTimeout(timeoutId);
        console.error('Snapshot error in CoachDashboard:', error);
        setConnectionError(true);
        setLoading(false);
      });
      return unsubscribe;
    };

    let unsubscribe = loadData();

    const handleRetry = () => {
      unsubscribe();
      startTimeout();
      unsubscribe = loadData();
    };

    window.addEventListener('retry-firestore', handleRetry);

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
      window.removeEventListener('retry-firestore', handleRetry);
    };
  }, []);

  const selectStudent = async (student: StudentSummary) => {
    setSelectedStudent(student);
    setActiveReport(student.latestReport);
    
    try {
      // Use a simpler query and sort locally to avoid composite index requirements
      const q = query(
        collection(db, 'reports'), 
        where('studentId', '==', student.id)
      );
      const snapshot = await getDocs(q);
      const fetchedReports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Report));
      
      fetchedReports.sort((a, b) => {
        const timeA = a.uploadDate?.toMillis?.() || (a as any).createdAt || 0;
        const timeB = b.uploadDate?.toMillis?.() || (b as any).createdAt || 0;
        return timeB - timeA;
      });

      setStudentReports(fetchedReports);
    } catch (error) {
      console.error('Error fetching student reports:', error);
    }
  };

  if (selectedStudent && activeReport) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-160px)]">
        <div className="flex flex-col gap-4 mb-6">
          <button 
            onClick={() => setSelectedStudent(null)}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-all self-start bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-100"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> 返回學員列表
          </button>
          
          <div className="flex flex-wrap items-center justify-between gap-3 w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex-shrink-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">正在查看</p>
                <p className="text-base font-black text-slate-900 mt-1">{selectedStudent.name}</p>
             </div>
             <div className="flex-grow sm:flex-grow-0 flex justify-end">
               <select 
                 className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto max-w-[200px] truncate"
                 value={activeReport.id}
                 onChange={(e) => setActiveReport(studentReports.find(r => r.id === e.target.value) || null)}
               >
                 {studentReports.map(r => (
                   <option key={r.id} value={r.id}>
                     {r.weekRange.includes('飲食體重紀錄') ? r.weekRange : `${r.weekRange} 飲食體重紀錄`}
                   </option>
                 ))}
               </select>
             </div>
          </div>
        </div>

        <div className="flex-grow bg-slate-100 rounded-3xl overflow-hidden shadow-inner flex justify-center p-2 sm:p-4 min-h-[600px] relative">
          <iframe 
            title="Student Report Web View"
            className="bg-white shadow-2xl w-full max-w-2xl rounded-2xl border-none transition-all duration-300"
            style={{ height: `${iframeHeight}px` }}
            srcDoc={injectResizeScript(activeReport.htmlContent)} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">學員週報管理</h2>
          <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">直接查看學員上傳的 HTML 網頁。</p>
        </div>
        <div className="bg-white px-5 py-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 self-start md:self-auto">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">學員總數</p>
            <p className="text-2xl font-black text-slate-900 leading-none">{students.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 animate-pulse h-40" />
          ))
        ) : connectionError ? (
          <div className="col-span-full py-20 px-8 bg-rose-50 rounded-3xl border border-rose-100 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-rose-100">
              <AlertCircle className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-xl font-black text-rose-900 mb-2">無法連線至資料庫</h3>
            <p className="text-rose-600 text-sm max-w-md mx-auto font-medium leading-relaxed">
              目前連線不穩定（Firestore code: unavailable）。這通常是暫時性的網路問題，請點擊下方按鈕嘗試重新連線。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <button 
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto px-8 py-3 bg-rose-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
              >
                重新整理頁面
              </button>
              <button 
                onClick={() => {
                  setLoading(true);
                  setConnectionError(false);
                  window.dispatchEvent(new Event('retry-firestore'));
                }}
                className="w-full sm:w-auto px-8 py-3 bg-white text-rose-600 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-rose-50 transition-all border border-rose-200 active:scale-95"
              >
                嘗試直接重連
              </button>
            </div>
          </div>
        ) : students.length > 0 ? (
          students.map(student => (
            <div 
              key={student.id}
              onClick={() => selectStudent(student)}
              className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 bg-slate-50 rounded-[24px] flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner border border-slate-100">
                  <UserIcon className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 leading-tight mb-1">{student.name}</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{student.reportCount} 份報告</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-5 border-t border-slate-50 mt-auto">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> 最新上傳週次
                  </p>
                  <p className="text-sm font-bold text-slate-900 line-clamp-1">
                    {student.latestReport?.weekRange 
                      ? (student.latestReport.weekRange.includes('飲食體重紀錄') ? student.latestReport.weekRange : `${student.latestReport.weekRange} 飲食體重紀錄`) 
                      : '尚未上傳'}
                  </p>
                </div>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    selectStudent(student);
                  }}
                  className="w-full bg-slate-50 hover:bg-indigo-600 text-slate-400 hover:text-white font-bold py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm hover:shadow-md mt-2"
                >
                  開啟網頁週報
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">目前尚無學員數據</p>
          </div>
        )}
      </div>
    </div>
  );
}


