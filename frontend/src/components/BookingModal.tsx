import { useState } from 'react';
import {
  X,
  Clock,
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Users,
  MessageSquare,
} from 'lucide-react';
import { reservationsApi, Room, PublicReservation } from '../lib/api';
import { generateTimeSlots, timeToMinutes, isSlotOccupied } from '../lib/timeSlots';

interface Props {
  room: Room;
  date: string;
  startTime: string;
  reservations: PublicReservation[];
  onClose: () => void;
  onSuccess: () => void;
}

const allSlots = generateTimeSlots();

function getAvailableEndTimes(
  startTime: string,
  reservations: PublicReservation[],
): string[] {
  const startMin = timeToMinutes(startTime);
  const startIdx = allSlots.indexOf(startTime);
  const endTimes: string[] = [];

  for (let i = startIdx + 1; i < allSlots.length; i++) {
    const slot = allSlots[i];
    const slotMin = timeToMinutes(slot);

    // Verificar si el slot intermedio está ocupado
    const blocked = reservations.some((r) => {
      const rStart = timeToMinutes(r.startTime);
      const rEnd = timeToMinutes(r.endTime);
      return startMin < rEnd && slotMin > rStart && slotMin <= rEnd;
    });

    if (blocked) break;
    endTimes.push(slot);
  }

  // Permitir hasta las 18:00
  if (!endTimes.includes('18:00')) {
    const lastSlot = endTimes[endTimes.length - 1];
    if (lastSlot) {
      const lastMin = timeToMinutes(lastSlot);
      if (lastMin < timeToMinutes('18:00')) {
        endTimes.push('18:00');
      }
    } else {
      endTimes.push('18:00');
    }
  }

  return endTimes;
}

type Step = 'time' | 'form' | 'success';

export default function BookingModal({
  room,
  date,
  startTime,
  reservations,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>('time');
  const [endTime, setEndTime] = useState('');
  const [form, setForm] = useState({
    requesterName: '',
    email: '',
    phone: '',
    attendees: '',
    topic: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const availableEndTimes = getAvailableEndTimes(startTime, reservations);

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('es-HN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleSubmit = async () => {
    setError('');

    if (!form.requesterName.trim()) {
      setError('El nombre completo es requerido');
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Ingresa un correo electrónico válido');
      return;
    }
    if (!form.phone.trim() || form.phone.length < 8) {
      setError('Ingresa un número de celular válido');
      return;
    }
    const attendeesNum = parseInt(form.attendees);
    if (!form.attendees || isNaN(attendeesNum) || attendeesNum < 1) {
      setError('Ingresa la cantidad de personas (mínimo 1)');
      return;
    }

    setIsLoading(true);
    try {
      await reservationsApi.create({
        roomId: room.id,
        date,
        startTime,
        endTime,
        requesterName: form.requesterName,
        email: form.email,
        phone: form.phone,
        attendees: attendeesNum,
        topic: form.topic.trim() || undefined,
      });
      setStep('success');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Ocurrió un error al crear la reserva. Intenta de nuevo.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={step !== 'success' ? onClose : undefined}
      />

      {/* Centering wrapper */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-blue-100 text-xs font-medium">Reservar sala</p>
                <h2 className="text-white font-bold text-lg leading-tight">{room.name}</h2>
              </div>
            </div>
            {step !== 'success' && (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>

          {/* Date + start time info */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-100" />
              <span className="text-white text-xs font-medium">{displayDate}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-100" />
              <span className="text-white text-xs font-medium">Inicio: {startTime}</span>
            </div>
          </div>
        </div>

        {/* Step: Select end time */}
        {step === 'time' && (
          <div className="p-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">Hora de finalización</p>

            <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
              {availableEndTimes.map((t) => (
                <button
                  key={t}
                  onClick={() => setEndTime(t)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    endTime === t
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {endTime && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-700 font-medium">
                  Duración:{' '}
                  {(timeToMinutes(endTime) - timeToMinutes(startTime)) / 60 >= 1
                    ? `${(timeToMinutes(endTime) - timeToMinutes(startTime)) / 60} hora(s)`
                    : `${timeToMinutes(endTime) - timeToMinutes(startTime)} minutos`}
                </p>
              </div>
            )}

            <button
              onClick={() => setStep('form')}
              disabled={!endTime}
              className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <span>Continuar</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step: Fill form */}
        {step === 'form' && (
          <div className="flex flex-col">
            {/* Scrollable fields */}
            <div className="overflow-y-auto max-h-[55vh] px-6 pt-5 pb-2">
              <div className="flex items-center gap-2 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-sm text-gray-700 font-medium">
                  {startTime} — {endTime}
                </span>
                <button
                  onClick={() => setStep('time')}
                  className="ml-auto text-xs text-blue-600 font-semibold hover:underline"
                >
                  Cambiar
                </button>
              </div>

              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Nombre completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={form.requesterName}
                      onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
                      placeholder="Juan Pérez García"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Correo */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="juan.perez@empresa.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Celular */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Número de celular
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+504 9999-8888"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Cantidad de personas */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Cantidad de personas
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min={1}
                      value={form.attendees}
                      onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                      placeholder="Ej: 8"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Tema a tratar */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Tema a tratar <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                    <textarea
                      value={form.topic}
                      onChange={(e) => setForm({ ...form, topic: e.target.value })}
                      placeholder="Describe brevemente el tema de la reunión..."
                      rows={3}
                      maxLength={300}
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Esta información es confidencial y solo la verá el administrador.</p>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            {/* Botones fijos abajo */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setStep('time')}
                className="px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-gray-300 transition-all"
              >
                Atrás
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Solicitar Reserva'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Solicitud enviada</h3>
            <p className="text-sm text-gray-500 mb-6">
              Hemos recibido tu solicitud para <strong>{room.name}</strong> el {displayDate} de{' '}
              {startTime} a {endTime}. Recibirás una confirmación por correo electrónico.
            </p>
            <button
              onClick={onSuccess}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all"
            >
              Entendido
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
