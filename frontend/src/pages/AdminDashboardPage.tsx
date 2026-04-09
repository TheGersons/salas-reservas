import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  LogOut,
  Building2,
  Trash2,
  CheckCircle2,
  XCircle,
  Bell,
  Filter,
  Clock,
  Mail,
  Phone,
  User,
  RefreshCw,
  AlertCircle,
  Users,
  MessageSquare,
  Menu,
  X,
  History,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
} from 'lucide-react';

const PAGE_SIZE = 5;
const todayISO = () => new Date().toISOString().split('T')[0];
import { useAuth } from '../contexts/AuthContext';
import { adminApi, roomsApi, Reservation, Room } from '../lib/api';

type ReminderType = 'REMINDER_60' | 'REMINDER_30' | 'REMINDER_15' | 'CUSTOM';

const STATUS_ORDER: Record<string, number> = { PENDING: 0, CONFIRMED: 1, CANCELLED: 2 };

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

export default function AdminDashboardPage() {
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRoom, setFilterRoom] = useState<number | undefined>();
  const [filterDate, setFilterDate] = useState('');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [reminderModal, setReminderModal] = useState<Reservation | null>(null);

  useEffect(() => {
    roomsApi.getAll().then(setRooms);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getReservations({
        roomId: filterRoom,
        date: filterDate || undefined,
      });
      setReservations(data.sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    load();
  }, [filterRoom, filterDate]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleStatusUpdate = async (id: number, status: 'CONFIRMED' | 'CANCELLED') => {
    setActionLoading(id);
    try {
      await adminApi.updateStatus(id, status);
      showToast(
        status === 'CONFIRMED' ? 'Reserva confirmada. Se notificó al solicitante.' : 'Reserva cancelada.',
        'success',
      );
      load();
    } catch {
      showToast('Error al actualizar el estado.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta reservación? Se notificará al solicitante.')) return;
    setActionLoading(id);
    try {
      await adminApi.delete(id);
      showToast('Reservación eliminada.', 'success');
      load();
    } catch {
      showToast('Error al eliminar.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReminder = async (type: ReminderType) => {
    if (!reminderModal) return;
    setActionLoading(reminderModal.id);
    try {
      await adminApi.sendReminder(reminderModal.id, type);
      showToast('Recordatorio enviado correctamente.', 'success');
      setReminderModal(null);
    } catch {
      showToast('Error al enviar el recordatorio.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-HN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });

  const stats = {
    total: reservations.length,
    pending: reservations.filter((r) => r.status === 'PENDING').length,
    confirmed: reservations.filter((r) => r.status === 'CONFIRMED').length,
    cancelled: reservations.filter((r) => r.status === 'CANCELLED').length,
  };

  const totalPages = Math.max(1, Math.ceil(reservations.length / PAGE_SIZE));
  const paginated = useMemo(
    () => reservations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [reservations, page],
  );

  return (
    <div className="min-h-screen w-full bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-900 text-white flex flex-col flex-shrink-0 transition-transform duration-300 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Close button - mobile only */}
        <button
          className="absolute top-4 right-4 md:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Logo */}
        <div className="flex justify-center pt-4 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-4 flex items-center gap-4 w-full border border-blue-50">
            <div className="bg-blue-50 p-2 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 leading-tight">Energía PD</h2>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Salas</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-5 space-y-1.5 mt-2">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', href: '/admin', active: true },
            { icon: History, label: 'Historial', href: '/admin/history', active: false },
            { icon: CalendarDays, label: 'Calendario público', href: '/', active: false },
          ].map(({ icon: Icon, label, active, href }) => (
            <a
              key={label}
              href={href || '#'}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                active
                  ? 'bg-white text-blue-700 shadow-lg'
                  : 'text-blue-100 hover:bg-blue-600/30'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-blue-200'}`} />
              <span className={`font-medium text-sm ${active ? 'text-blue-900' : ''}`}>{label}</span>
            </a>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-5 border-t border-blue-700/50">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-blue-600/30 transition-all"
          >
            <LogOut className="w-5 h-5 text-blue-200" />
            <span className="font-medium text-sm">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Reservaciones</h1>
              <p className="text-xs sm:text-sm text-gray-400">Gestión y seguimiento de salas</p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Total', value: stats.total, color: 'text-gray-700', bg: 'bg-white' },
              { label: 'Pendientes', value: stats.pending, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: 'Confirmadas', value: stats.confirmed, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Canceladas', value: stats.cancelled, color: 'text-red-500', bg: 'bg-red-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl border border-gray-200 p-5`}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-500">Filtrar:</span>
              {(filterRoom || filterDate) && (
                <button
                  onClick={() => { setFilterRoom(undefined); setFilterDate(''); setPage(1); }}
                  className="ml-auto text-xs text-blue-600 font-semibold hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={filterRoom || ''}
                onChange={(e) => { setFilterRoom(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                className="text-sm border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none transition-all w-full"
              >
                <option value="">Todas las salas</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              <div className="flex gap-2">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
                  className="text-sm border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none transition-all flex-1 min-w-0"
                />
                <button
                  onClick={() => { setFilterDate(todayISO()); setPage(1); }}
                  title="Ver reservaciones de hoy"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all whitespace-nowrap ${
                    filterDate === todayISO()
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Hoy</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <CalendarDays className="w-10 h-10 mb-2 text-gray-300" />
                <p className="text-sm font-medium">No hay reservaciones</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Sala', 'Fecha', 'Horario', 'Solicitante', 'Contacto', 'Detalles', 'Estado', 'Acciones'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="text-sm font-semibold text-gray-800">{r.room.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm text-gray-700">{formatDate(r.date)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">
                              {r.startTime} — {r.endTime}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-sm text-gray-800">{r.requesterName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-600">{r.email}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-600">{r.phone}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1 max-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              <span className="text-xs font-semibold text-gray-700">{r.attendees} {r.attendees === 1 ? 'persona' : 'personas'}</span>
                            </div>
                            {r.topic && (
                              <div className="flex items-start gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-gray-600 leading-tight line-clamp-2">{r.topic}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold ${STATUS_COLORS[r.status]}`}
                          >
                            {STATUS_LABEL[r.status]}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            {/* Confirmar */}
                            {r.status === 'PENDING' && (
                              <button
                                onClick={() => handleStatusUpdate(r.id, 'CONFIRMED')}
                                disabled={actionLoading === r.id}
                                title="Confirmar reservación"
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-all disabled:opacity-50"
                              >
                                {actionLoading === r.id ? (
                                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                              </button>
                            )}

                            {/* Cancelar */}
                            {r.status !== 'CANCELLED' && (
                              <button
                                onClick={() => handleStatusUpdate(r.id, 'CANCELLED')}
                                disabled={actionLoading === r.id}
                                title="Cancelar reservación"
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-all disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}

                            {/* Recordatorio */}
                            {r.status !== 'CANCELLED' && (
                              <button
                                onClick={() => setReminderModal(r)}
                                title="Enviar recordatorio"
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200 transition-all"
                              >
                                <Bell className="w-4 h-4" />
                              </button>
                            )}

                            {/* Eliminar */}
                            <button
                              onClick={() => handleDelete(r.id)}
                              disabled={actionLoading === r.id}
                              title="Eliminar reservación"
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 border border-gray-200 hover:border-red-200 transition-all disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Página {page} de {totalPages} · {reservations.length} reservación{reservations.length !== 1 ? 'es' : ''}
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg border text-sm font-semibold transition-all ${p === page ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'}`}
                  >
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Reminder Modal */}
      {reminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setReminderModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-blue-100 text-xs">Enviar recordatorio</p>
                  <h3 className="text-white font-bold">{reminderModal.requesterName}</h3>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-500 mb-4">
                Selecciona el tipo de recordatorio a enviar a{' '}
                <span className="font-semibold text-gray-700">{reminderModal.email}</span>
              </p>

              {(
                [
                  { type: 'REMINDER_60' as ReminderType, label: 'Faltan 60 minutos' },
                  { type: 'REMINDER_30' as ReminderType, label: 'Faltan 30 minutos' },
                  { type: 'REMINDER_15' as ReminderType, label: 'Faltan 15 minutos' },
                  { type: 'CUSTOM' as ReminderType, label: 'Recordatorio general' },
                ] as const
              ).map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => handleReminder(type)}
                  disabled={actionLoading === reminderModal.id}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 font-medium text-sm transition-all disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-blue-500" />
                    {label}
                  </div>
                  {actionLoading === reminderModal.id ? (
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ))}

              <button
                onClick={() => setReminderModal(null)}
                className="w-full mt-2 py-2.5 rounded-xl border-2 border-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border transition-all ${
            toast.type === 'success'
              ? 'bg-white border-blue-200 text-blue-700'
              : 'bg-white border-red-200 text-red-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
