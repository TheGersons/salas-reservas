import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  LogOut,
  Building2,
  Filter,
  Clock,
  Mail,
  User,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Menu,
  X,
  History,
  ChevronLeft,
  ChevronRight,
  Users,
  MessageSquare,
  CalendarCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminApi, roomsApi, Reservation, Room } from '../lib/api';

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

const PAGE_SIZE = 5;
const todayISO = () => new Date().toISOString().split('T')[0];

export default function AdminHistoryPage() {
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRoom, setFilterRoom] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    roomsApi.getAll().then(setRooms);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getReservations({
        roomId: filterRoom,
        dateFrom: filterFrom || undefined,
        dateTo: filterTo || undefined,
      });
      // Ordenar por fecha descendente
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);
      setReservations(data);
      setPage(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterRoom, filterFrom, filterTo]);

  const filtered = useMemo(() => {
    if (!filterStatus) return reservations;
    return reservations.filter((r) => r.status === filterStatus);
  }, [reservations, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-HN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });

  const clearFilters = () => {
    setFilterRoom(undefined);
    setFilterStatus('');
    setFilterFrom('');
    setFilterTo('');
    setPage(1);
  };

  const hasFilters = filterRoom || filterStatus || filterFrom || filterTo;

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
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-900 text-white flex flex-col flex-shrink-0 transition-transform duration-300 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          className="absolute top-4 right-4 md:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-4 h-4" />
        </button>

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

        <nav className="flex-1 p-5 space-y-1.5 mt-2">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', href: '/admin', active: false },
            { icon: History, label: 'Historial', href: '/admin/history', active: true },
            { icon: CalendarDays, label: 'Calendario público', href: '/', active: false },
          ].map(({ icon: Icon, label, href, active }) => (
            <a
              key={label}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                active ? 'bg-white text-blue-700 shadow-lg' : 'text-blue-100 hover:bg-blue-600/30'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-blue-200'}`} />
              <span className={`font-medium text-sm ${active ? 'text-blue-900' : ''}`}>{label}</span>
            </a>
          ))}
        </nav>

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

      {/* Main */}
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
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Historial</h1>
              <p className="text-xs sm:text-sm text-gray-400">
                {filtered.length} reservación{filtered.length !== 1 ? 'es' : ''}
              </p>
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
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-500">Filtrar:</span>
              {hasFilters && (
                <button onClick={clearFilters} className="ml-auto text-xs text-blue-600 font-semibold hover:underline">
                  Limpiar
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Sala */}
              <select
                value={filterRoom || ''}
                onChange={(e) => { setFilterRoom(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                className="text-sm border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none w-full"
              >
                <option value="">Todas las salas</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>

              {/* Estado */}
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="text-sm border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none w-full"
              >
                <option value="">Todos los estados</option>
                <option value="PENDING">Pendiente</option>
                <option value="CONFIRMED">Confirmada</option>
                <option value="CANCELLED">Cancelada</option>
              </select>

              {/* Desde */}
              <div className="relative">
                <label className="absolute -top-2.5 left-2.5 bg-white px-1 text-xs text-gray-400 pointer-events-none">
                  Desde
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
                    className="text-sm border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none flex-1 min-w-0"
                  />
                  <button
                    onClick={() => { setFilterFrom(todayISO()); setFilterTo(todayISO()); setPage(1); }}
                    title="Ver solo hoy"
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all whitespace-nowrap ${
                      filterFrom === todayISO() && filterTo === todayISO()
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    <CalendarCheck className="w-4 h-4" />
                    <span className="hidden sm:inline">Hoy</span>
                  </button>
                </div>
              </div>

              {/* Hasta */}
              <div className="relative">
                <label className="absolute -top-2.5 left-2.5 bg-white px-1 text-xs text-gray-400 pointer-events-none">
                  Hasta
                </label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
                  className="text-sm border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none w-full"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <History className="w-10 h-10 mb-2 text-gray-300" />
                <p className="text-sm font-medium">No hay reservaciones</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="mt-2 text-xs text-blue-600 font-semibold hover:underline">
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Sala', 'Fecha', 'Horario', 'Solicitante', 'Detalles', 'Estado'].map((h) => (
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
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm text-gray-800">{r.requesterName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{r.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1 max-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              <span className="text-xs font-semibold text-gray-700">
                                {r.attendees} {r.attendees === 1 ? 'persona' : 'personas'}
                              </span>
                            </div>
                            {r.topic && (
                              <div className="flex items-start gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-gray-600 line-clamp-2">{r.topic}</span>
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
                Página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg border text-sm font-semibold transition-all ${
                      p === page
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
