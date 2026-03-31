import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Building2, Calendar } from 'lucide-react';
import { roomsApi, reservationsApi, Room, PublicReservation } from '../lib/api';
import {
  generateTimeSlots,
  getWeekDays,
  formatDateToISO,
  formatDisplayDate,
  isToday,
  isPastSlot,
  getSlotReservation,
  isSlotOccupied,
} from '../lib/timeSlots';
import BookingModal from '../components/BookingModal';

export default function PublicCalendarPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [reservations, setReservations] = useState<PublicReservation[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  // Modal de reserva
  const [bookingSlot, setBookingSlot] = useState<{
    date: string;
    startTime: string;
  } | null>(null);

  const timeSlots = generateTimeSlots();
  const weekDays = getWeekDays(referenceDate);
  // Solo lunes a viernes
  const weekdaysOnly = weekDays.slice(0, 5);

  // Cargar salas
  useEffect(() => {
    roomsApi.getAll().then((data) => {
      setRooms(data);
      if (data.length > 0) setSelectedRoom(data[0]);
    });
  }, []);

  // Cargar reservas cuando cambia sala o semana
  const loadReservations = useCallback(async () => {
    if (!selectedRoom) return;
    setLoading(true);
    try {
      const dateFrom = formatDateToISO(weekdaysOnly[0]);
      const dateTo = formatDateToISO(weekdaysOnly[4]);
      const data = await reservationsApi.getPublic({
        roomId: selectedRoom.id,
        dateFrom,
        dateTo,
      });
      setReservations(data);
    } finally {
      setLoading(false);
    }
  }, [selectedRoom, weekOffset]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const goToPrevWeek = () => {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - 7);
    setReferenceDate(d);
    setWeekOffset((o) => o - 1);
  };

  const goToNextWeek = () => {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 7);
    setReferenceDate(d);
    setWeekOffset((o) => o + 1);
  };

  const goToCurrentWeek = () => {
    setReferenceDate(new Date());
    setWeekOffset(0);
  };

  const handleSlotClick = (dateStr: string, slot: string) => {
    if (!selectedRoom) return;
    const dateDay = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = dateDay.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return;

    const dayReservations = reservations.filter(
      (r) => r.date.split('T')[0] === dateStr && r.roomId === selectedRoom.id,
    );
    if (isSlotOccupied(slot, dayReservations)) return;
    if (isPastSlot(dateStr, slot)) return;

    setBookingSlot({ date: dateStr, startTime: slot });
  };

  const getSlotState = (dateStr: string, slot: string) => {
    if (!selectedRoom) return 'available';
    const dayReservations = reservations.filter(
      (r) => r.date.split('T')[0] === dateStr && r.roomId === selectedRoom.id,
    );
    const reservation = getSlotReservation(slot, dayReservations);
    if (reservation) return reservation.status === 'CONFIRMED' ? 'confirmed' : 'pending';
    if (isPastSlot(dateStr, slot)) return 'past';
    return 'available';
  };

  const getSlotReservationForDay = (dateStr: string, slot: string) => {
    if (!selectedRoom) return undefined;
    const dayReservations = reservations.filter(
      (r) => r.date.split('T')[0] === dateStr && r.roomId === selectedRoom.id,
    );
    return getSlotReservation(slot, dayReservations);
  };

  const isFirstSlotOfReservation = (dateStr: string, slot: string) => {
    const res = getSlotReservationForDay(dateStr, slot);
    if (!res) return false;
    return res.startTime === slot;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-none">Energía PD</h1>
              <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">
                Reserva de Salas
              </p>
            </div>
          </div>

          <a
            href="/admin/login"
            className="text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors"
          >
            Acceso Administrador
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Room Selector */}
        <div className="mb-6 sm:mb-8">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Selecciona una sala
          </p>
          <div className="flex gap-3 flex-wrap">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 transition-all duration-200 ${
                  selectedRoom?.id === room.id
                    ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <Building2
                  className={`w-5 h-5 ${selectedRoom?.id === room.id ? 'text-white' : 'text-blue-500'}`}
                />
                <span className="font-semibold">{room.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Calendar header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevWeek}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={goToNextWeek}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <span className="font-semibold text-gray-800 capitalize">
                {weekdaysOnly[0].toLocaleDateString('es-HN', { month: 'long', year: 'numeric' })}
              </span>

              {weekOffset !== 0 && (
                <button
                  onClick={goToCurrentWeek}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Semana actual
                </button>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-white border border-gray-300" />
                <span className="text-xs text-gray-500">Disponible</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-600" />
                <span className="text-xs text-gray-500">Confirmado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-200" />
                <span className="text-xs text-gray-500">Pendiente</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gray-100" />
                <span className="text-xs text-gray-500">No disponible</span>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-auto max-h-[620px]">
              <div className="min-w-[700px]">
                {/* Day headers */}
                <div className="grid border-b border-gray-100 sticky top-0 z-20 bg-white" style={{ gridTemplateColumns: '72px repeat(5, 1fr)' }}>
                  <div className="py-3 px-2 sticky left-0 z-30 bg-white" />
                  {weekdaysOnly.map((day) => {
                    const today = isToday(day);
                    const dateStr = formatDateToISO(day);
                    const past = new Date(dateStr + 'T23:59:59') < new Date();
                    return (
                      <div
                        key={dateStr}
                        className={`py-3 px-3 text-center border-l border-gray-100 ${today ? 'bg-blue-50' : ''}`}
                      >
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            today ? 'text-blue-600' : past ? 'text-gray-300' : 'text-gray-400'
                          }`}
                        >
                          {day.toLocaleDateString('es-HN', { weekday: 'short' })}
                        </p>
                        <p
                          className={`text-lg font-bold mt-0.5 ${
                            today
                              ? 'text-blue-700'
                              : past
                              ? 'text-gray-300'
                              : 'text-gray-800'
                          }`}
                        >
                          {day.getDate()}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Time slots */}
                <div>
                  {timeSlots.map((slot, slotIdx) => (
                    <div
                      key={slot}
                      className="grid border-b border-gray-50"
                      style={{ gridTemplateColumns: '72px repeat(5, 1fr)' }}
                    >
                      {/* Time label - sticky left */}
                      <div className="sticky left-0 z-10 bg-white flex items-start justify-end pr-3 pt-1.5 border-r border-gray-100">
                        <span className="text-xs text-gray-400 font-medium">{slot}</span>
                      </div>

                      {/* Day cells */}
                      {weekdaysOnly.map((day) => {
                        const dateStr = formatDateToISO(day);
                        const state = getSlotState(dateStr, slot);
                        const reservation = getSlotReservationForDay(dateStr, slot);
                        const isFirst = isFirstSlotOfReservation(dateStr, slot);
                        const isPast = state === 'past';
                        const isOccupied = state === 'confirmed' || state === 'pending';

                        return (
                          <div
                            key={dateStr}
                            onClick={() =>
                              !isOccupied && !isPast && handleSlotClick(dateStr, slot)
                            }
                            className={`
                              relative border-l border-gray-100 h-10 transition-all duration-150
                              ${isToday(day) ? 'bg-blue-50/40' : ''}
                              ${
                                state === 'confirmed'
                                  ? 'bg-blue-600'
                                  : state === 'pending'
                                  ? 'bg-blue-200'
                                  : state === 'past'
                                  ? 'bg-gray-50 cursor-not-allowed'
                                  : 'bg-white cursor-pointer hover:bg-blue-50 hover:border-blue-200 group'
                              }
                            `}
                          >
                            {/* Hover label para slots disponibles */}
                            {state === 'available' && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs text-blue-500 font-semibold">Reservar</span>
                              </div>
                            )}

                            {/* Info de reserva (solo en el primer slot) */}
                            {isOccupied && isFirst && reservation && (
                              <div className="absolute inset-x-0 top-0 px-2 py-1 z-10">
                                <p
                                  className={`text-xs font-semibold truncate leading-tight ${
                                    state === 'confirmed' ? 'text-white' : 'text-blue-800'
                                  }`}
                                >
                                  {reservation.requesterName}
                                </p>
                                <p
                                  className={`text-xs truncate ${
                                    state === 'confirmed'
                                      ? 'text-blue-100'
                                      : 'text-blue-600'
                                  }`}
                                >
                                  {reservation.startTime} — {reservation.endTime}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Horario de reservas: Lunes a Viernes, 07:00 — 18:00. Bloques de 30 minutos.
        </p>
      </div>

      {/* Booking Modal */}
      {bookingSlot && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          date={bookingSlot.date}
          startTime={bookingSlot.startTime}
          reservations={reservations.filter(
            (r) =>
              r.date.split('T')[0] === bookingSlot.date &&
              r.roomId === selectedRoom.id,
          )}
          onClose={() => setBookingSlot(null)}
          onSuccess={() => {
            setBookingSlot(null);
            loadReservations();
          }}
        />
      )}
    </div>
  );
}
