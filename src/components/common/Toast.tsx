/**
 * Toast Component
 *
 * Displays temporary notification messages with different types
 * (success, error, info). Auto-dismisses after a timeout.
 */

import { useEffect } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useStore } from "../../store";

export function Toast() {
  const { toastMessage, clearToast } = useStore();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(clearToast, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  };

  const bgColors = {
    success: "bg-emerald-950 border-emerald-500/30",
    error: "bg-red-950 border-red-500/30",
    info: "bg-blue-950 border-blue-500/30",
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColors[toastMessage.type]}`}
      >
        {icons[toastMessage.type]}
        <span className="text-sm text-slate-100">{toastMessage.message}</span>
        <button
          onClick={clearToast}
          className="ml-2 text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
