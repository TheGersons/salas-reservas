import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Adjuntar token JWT en cada request si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirigir al login si el token expiró
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  },
);

export default api;

// ─── Types ────────────────────────────────────────────
export interface Room {
  id: number;
  name: string;
  description?: string;
}

export interface Reservation {
  id: number;
  roomId: number;
  room: Room;
  seriesId?: number | null;
  date: string;
  startTime: string;
  endTime: string;
  requesterName: string;
  email: string;
  phone: string;
  attendees: number;
  topic?: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  remindersSent?: { type: string; sentAt: string }[];
}

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
export type DurationUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';
export type BulkDateStatus = 'OK' | 'CONFLICT' | 'WEEKEND' | 'OUT_OF_HOURS' | 'PAST';

export interface BulkPreviewDate {
  date: string;
  status: BulkDateStatus;
  conflictWith?: { id: number; startTime: string; endTime: string; requesterName: string };
  reason?: string;
}

export interface BulkPreviewResponse {
  rrule: string;
  startTime: string;
  endTime: string;
  totalDates: number;
  summary: { ok: number; conflicts: number; weekend: number; outOfHours: number; past: number };
  dates: BulkPreviewDate[];
}

export interface PreviewBulkPayload {
  roomId: number;
  startDate: string;
  startTime: string;
  endTime: string;
  frequency: Frequency;
  interval?: number;
  byWeekday?: Weekday[];
  byMonthDay?: number;
  durationValue: number;
  durationUnit: DurationUnit;
  attendees: number;
}

export interface CreateBulkPayload extends PreviewBulkPayload {
  requesterName: string;
  email: string;
  phone: string;
  topic?: string;
  skipConflicts: boolean;
}

export interface ReservationSeries {
  id: number;
  roomId: number;
  room: Room;
  requesterName: string;
  email: string;
  phone: string;
  attendees: number;
  topic?: string;
  startTime: string;
  endTime: string;
  rrule: string;
  firstDate: string;
  lastDate: string;
  totalCount: number;
  status: 'ACTIVE' | 'CANCELLED';
  reservations: Reservation[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBulkResponse {
  series: ReservationSeries;
  createdCount: number;
  skippedCount: number;
  skipped: BulkPreviewDate[];
}

export interface PublicReservation {
  id: number;
  roomId: number;
  room: { id: number; name: string };
  date: string;
  startTime: string;
  endTime: string;
  requesterName: string;
  status: 'PENDING' | 'CONFIRMED';
}

// ─── API calls ────────────────────────────────────────
export const roomsApi = {
  getAll: () => api.get<Room[]>('/rooms').then((r) => r.data),
};

export const reservationsApi = {
  getPublic: (params: { roomId?: number; dateFrom?: string; dateTo?: string }) =>
    api.get<PublicReservation[]>('/reservations', { params }).then((r) => r.data),

  create: (data: {
    roomId: number;
    date: string;
    startTime: string;
    endTime: string;
    requesterName: string;
    email: string;
    phone: string;
    attendees: number;
    topic?: string;
  }) => api.post<Reservation>('/reservations', data).then((r) => r.data),
};

export const adminApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string }>('/auth/login', { email, password }).then((r) => r.data),

  getReservations: (params?: {
    roomId?: number;
    dateFrom?: string;
    dateTo?: string;
    date?: string;
  }) => api.get<Reservation[]>('/admin/reservations', { params }).then((r) => r.data),

  updateStatus: (id: number, status: 'PENDING' | 'CONFIRMED' | 'CANCELLED') =>
    api.patch<Reservation>(`/admin/reservations/${id}/status`, { status }).then((r) => r.data),

  delete: (id: number) => api.delete(`/admin/reservations/${id}`),

  sendReminder: (id: number, type: 'REMINDER_60' | 'REMINDER_30' | 'REMINDER_15' | 'CUSTOM') =>
    api.post(`/admin/reservations/${id}/remind`, { type }).then((r) => r.data),

  previewBulk: (data: PreviewBulkPayload) =>
    api.post<BulkPreviewResponse>('/admin/reservations/bulk/preview', data).then((r) => r.data),

  createBulk: (data: CreateBulkPayload) =>
    api.post<CreateBulkResponse>('/admin/reservations/bulk', data).then((r) => r.data),

  getSeries: (id: number) =>
    api.get<ReservationSeries>(`/admin/reservations/series/${id}`).then((r) => r.data),

  cancelSeries: (id: number) =>
    api
      .patch<{ success: boolean; cancelledCount: number; series: ReservationSeries }>(
        `/admin/reservations/series/${id}/cancel`,
      )
      .then((r) => r.data),

  deleteSeries: (id: number) => api.delete(`/admin/reservations/series/${id}`),
};
