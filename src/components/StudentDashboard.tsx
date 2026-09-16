import React, { useState, useRef, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile } from '../hooks/useAuth';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, History, ChevronRight, Eye, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface StudentDashboardProps {
  profile: UserProfile | null;
  user: User;
}

interface Report {
  id: string;
  weekRange: string;
  htmlContent: string;
  uploadDate: any;
}

export default function StudentDashboard({ profile, user }: StudentDashboardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [connectionError, setConnectionError] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState(800);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  const isUploadingRef = useRef(isUploading);
  useEffect(() => {
    isUploadingRef.current = isUploading;
  }, [isUploading]);

  useEffect(() => {
    const loadReports = () => {
      const q = query(
        collection(db, 'reports'),
        where('studentId', '==', user.uid),
        orderBy('uploadDate', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setConnectionError(false);
        const fetchedReports = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Report));
        setReports(fetchedReports);
        
        // Use ref to get the latest value in the snapshot callback
        if (isUploadingRef.current && fetchedReports.length > 0) {
          // If a document exists without a server timestamp yet, it's our optimistic update
          const hasPendingOrNew = fetchedReports.some(r => !r.uploadDate || (Date.now() - (r as any).createdAt < 5000));
          if (hasPendingOrNew) {
             setUploadProgress(100);
             setUploadStatus('success');
             setIsUploading(false);
             if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }
      }, (error) => {
        console.error("Snapshot error in StudentDashboard:", error);
        setConnectionError(true);
      });
      return unsubscribe;
    };

    let unsubscribe = loadReports();

    const handleRetry = () => {
      unsubscribe();
      unsubscribe = loadReports();
    };

    window.addEventListener('retry-firestore', handleRetry);
    return () => {
      unsubscribe();
      window.removeEventListener('retry-firestore', handleRetry);
    };
  }, [user.uid]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file size (Firestore limit is 1MB per document)
    if (file.size > 1024 * 1024) {
      setErrorMessage('檔案太大 (超過 1MB)，請嘗試移除 HTML 中的大型圖片後再上傳');
      setUploadStatus('error');
      return;
    }

    if (file.type !== 'text/html') {
      setUploadStatus('error');
      setErrorMessage('僅支援 HTML 檔案');
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');
    setUploadProgress(10);
    console.log("Starting file upload process for:", file.name);

    try {
      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 40);
          setUploadProgress(10 + percent); // 10-50% for reading
        }
      };

      reader.onerror = () => {
        console.error("FileReader error");
        setErrorMessage("檔案讀取錯誤");
        setUploadStatus('error');
        setIsUploading(false);
      };

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          if (!content) throw new Error("File content is empty");

          setUploadProgress(60);
          console.log("File read success, size:", content.length);
          
          // Basic week range extraction
          const weekRangeMatch = content.match(/class="range">([^<]+)/);
          const weekRange = weekRangeMatch ? weekRangeMatch[1] : '未知週次';

          setUploadProgress(75);
          console.log("Extracting week range:", weekRange);

          const docRef = await addDoc(collection(db, 'reports'), {
            studentId: user.uid,
            studentName: user.displayName || profile?.name || '學員',
            weekRange,
            htmlContent: content,
            createdAt: Date.now(), // Client-side timestamp for immediate ordering
            uploadDate: serverTimestamp(),
          });

          // Final confirmation
          setUploadProgress(100);
          setUploadStatus('success');
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (dbError) {
          console.error('Firestore upload failed:', dbError);
          // If we fail here but the snapshot already took it, it's fine.
          // But if we're still isUploading, show error.
          if (isUploading) {
            setErrorMessage('資料庫儲存失敗，請檢查網路連接');
            setUploadStatus('error');
            setIsUploading(false);
          }
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Reader setup failed:', error);
      setUploadStatus('error');
      setErrorMessage('系統錯誤，請重整頁面後再試');
      setIsUploading(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const reportRef = doc(db, 'reports', reportId);
      await deleteDoc(reportRef);
      setDeletingId(null);
    } catch (error: any) {
      console.error('Delete failed:', error);
      alert(`刪除失敗：${error.message || '未知錯誤'}，請檢查權限或網路。`);
      setDeletingId(null);
    }
  };

  if (viewingReport) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button 
            onClick={() => setViewingReport(null)}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-all self-start"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> 返回儀表板
          </button>
          <div className="text-left sm:text-right px-1">
            <h2 className="text-lg font-black text-slate-900 leading-tight">週報預覽：{viewingReport.weekRange}</h2>
          </div>
        </div>
        <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100">
          <div className="p-2 sm:p-4 bg-slate-100 flex justify-center">
            <iframe 
              ref={iframeRef}
              title="Report Detail"
              className="bg-white shadow-2xl w-full max-w-2xl rounded-lg border-none transition-all duration-300"
              style={{ height: `${iframeHeight}px` }}
              srcDoc={injectResizeScript(viewingReport.htmlContent)} 
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">上傳週報</h2>
        <p className="text-sm sm:text-base text-slate-500 mb-6 sm:mb-8 font-medium">上傳您的 HTML 週報檔案，直接儲存並同步給教練。</p>

        <div 
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all gap-4",
            isUploading ? "bg-slate-50 border-slate-200 cursor-not-allowed" : "border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/30"
          )}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".html"
            disabled={isUploading}
          />
          
          {isUploading ? (
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          ) : (
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-indigo-600" />
            </div>
          )}
          
          <div className="text-center w-full max-w-xs">
            <p className="text-lg font-bold text-slate-900 mb-2">
              {isUploading ? '正在同步週報...' : '點擊或拖曳檔案至此'}
            </p>
            {isUploading && (
              <div className="space-y-2">
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                  傳輸中 {uploadProgress}%
                </p>
              </div>
            )}
            {!isUploading && <p className="text-sm font-medium text-slate-500">支援 .html 格式</p>}
          </div>
        </div>

        {uploadStatus === 'success' && (
          <div className="mt-6 p-6 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <p className="text-lg font-bold">報告儲存成功！</p>
            </div>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="mt-6 p-4 bg-rose-50 text-rose-700 rounded-2xl flex items-center gap-3 border border-rose-100 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-bold">{errorMessage}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-100 overflow-hidden">
        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2 px-2">
          <History className="w-6 h-6 text-indigo-600" /> 上傳歷程
        </h3>
        
        {connectionError && (
          <div className="mx-2 mb-6 p-6 bg-rose-50 text-rose-700 rounded-3xl flex flex-col items-center gap-4 border border-rose-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <p className="text-sm font-black uppercase tracking-widest">連線不穩定</p>
            </div>
            <p className="text-xs font-bold text-center text-rose-600 max-w-md">
              目前無法穩定連接到資料庫（Code: unavailable）。請嘗試點擊下方按鈕重新連線。
            </p>
            <button 
              onClick={() => {
                setConnectionError(false);
                window.dispatchEvent(new Event('retry-firestore'));
              }}
              className="px-6 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-200"
            >
              重新連線
            </button>
          </div>
        )}
        
        <div className="space-y-4">
          {reports.length > 0 ? (
            reports.map((report) => (
              <div 
                key={report.id} 
                className="p-5 sm:p-6 bg-slate-50/50 hover:bg-white rounded-3xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-slate-100 hover:border-indigo-200 hover:shadow-md group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-white rounded-2xl flex-shrink-0 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm border border-slate-50">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-900 break-words text-base sm:text-lg leading-tight">{report.weekRange}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        已同步：{report.uploadDate?.toDate 
                          ? report.uploadDate.toDate().toLocaleString() 
                          : (report as any).createdAt 
                            ? new Date((report as any).createdAt).toLocaleString() 
                            : '處理中...'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                   {deletingId === report.id ? (
                     <div className="flex-1 sm:flex-none flex items-center gap-2 bg-rose-50 p-1 rounded-2xl border border-rose-100 animate-in fade-in zoom-in-95 duration-200">
                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-2 hidden xs:block">確定刪除？</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteReport(report.id);
                          }}
                          className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all shadow-sm active:scale-95"
                        >
                          刪除
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(null);
                          }}
                          className="px-4 py-2 bg-white text-slate-400 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all border border-slate-200 active:scale-95"
                        >
                          取消
                        </button>
                     </div>
                   ) : (
                     <>
                       <button 
                        onClick={() => setViewingReport(report)}
                        className="flex-1 sm:flex-none justify-center px-5 py-3 bg-white hover:bg-indigo-600 rounded-2xl text-slate-600 hover:text-white transition-all shadow-sm border border-slate-100 hover:border-indigo-600 flex items-center gap-2 active:scale-95 font-bold text-sm"
                       >
                         <Eye className="w-4 h-4" />
                         查看報告
                       </button>
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(report.id);
                        }}
                        className="px-5 py-3 bg-white hover:bg-rose-600 rounded-2xl text-slate-400 hover:text-white transition-all shadow-sm border border-slate-100 hover:border-rose-600 flex items-center gap-2 active:scale-95 font-bold text-sm"
                        title="刪除"
                       >
                         <Trash2 className="w-4 h-4" />
                         <span className="sm:hidden">刪除</span>
                       </button>
                     </>
                   )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                <FileText className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold">尚無上傳紀錄</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


