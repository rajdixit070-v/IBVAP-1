import React, { useState, useEffect } from 'react';
import { Notification } from '../../types/incident';
import { incidentService } from '../../services/incidentService';
import { Bell, CheckCheck, X } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAlert?: (alertId: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onSelectAlert
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await incidentService.getNotifications();
      setNotifications(data);
    } catch (e) {
      console.error('Failed to load notifications', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await incidentService.markAllNotificationsRead();
      loadNotifications();
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 md:w-96 bg-[#090d16] border-l border-[#1e293b] shadow-2xl flex flex-col justify-between">
      {/* Header */}
      <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#0d131f]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            SOC Alert Notifications
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="p-1.5 text-slate-400 hover:text-sky-400 transition"
            title="Mark all read"
          >
            <CheckCheck className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-xs font-mono text-slate-500">Loading alerts...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-xs font-mono text-slate-500">No new notifications.</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => n.alert_id && onSelectAlert && onSelectAlert(n.alert_id)}
              className={`p-3 rounded-xl border transition cursor-pointer space-y-1.5 ${
                !n.read
                  ? 'bg-[#111a2e] border-sky-500/40 hover:border-sky-400'
                  : 'bg-[#090d16] border-[#1e293b] opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    n.priority === 'CRITICAL'
                      ? 'bg-rose-950/70 text-rose-300 border-rose-500/30'
                      : 'bg-amber-950/70 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {n.priority}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(n.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-xs font-bold text-white">{n.title}</div>
              <p className="text-[11px] text-slate-400 leading-snug">{n.message}</p>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[#1e293b] bg-[#0d131f] text-center text-[10px] font-mono text-slate-500">
        Connected to IBVAP Command Bus
      </div>
    </div>
  );
};
