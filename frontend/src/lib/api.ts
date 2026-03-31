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
};
