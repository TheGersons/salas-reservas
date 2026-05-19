import { useState, useEffect } from 'react';
import {
  X,
  Repeat,
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Users,
  MessageSquare,
  Clock,
  AlertTriangle,
  CalendarX,
  Loader2,
} from 'lucide-react';
import {
  adminApi,
  roomsApi,
  Room,
  Frequency,
  Weekday,
  DurationUnit,
  BulkPreviewResponse,
  BulkDateStatus,
  PreviewBulkPayload,
} from '../lib/api';
import { generateTimeSlots, timeToMinutes } from '../lib/timeSlots';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const allSlots = generateTimeSlots();

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: 'MO', label: 'Lun' },
  { key: 'TU', label: 'Mar' },
  { key: 'WE', label: 'Mié' },
  { key: 'TH', label: 'Jue' },
  { key: 'FR', label: 'Vie' },
];

const DURATION_UNITS: { key: DurationUnit; label: string }[] = [
  { key: 'DAYS', label: 'días' },
  { key: 'WEEKS', label: 'semanas' },
  { key: 'MONTHS', label: 'meses' },
  { key: 'YEARS', label: 'años' },
];

const STATUS_STYLE: Record<BulkDateStatus, { label: string; cls: string }> = {
  OK: { label: 'Disponible', cls: 'bg-green-50 text-green-700 border-green-200' },
  CONFLICT: { label: 'Conflicto', cls: 'bg-red-50 text-red-700 border-red-200' },
  WEEKEND: { label: 'Fin de semana', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  OUT_OF_HOURS: { label: 'Fuera de horario', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  PAST: { label: 'Pasada', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

type Step = 'basics' | 'recurrence' | 'preview' | 'success';

const todayISO = () => new Date().toISOString().split('T')[0];

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-HN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function BulkReservationModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('basics');
  const [rooms, setRooms] = useState<Room[]>([]);

  // Paso 1
  const [roomId, setRoomId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(todayISO());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [requesterName, setRequesterName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [attendees, setAttendees] = useState('1');
  const [topic, setTopic] = useState('');

  // Paso 2
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [frequency, setFrequency] = useState<Frequency>('WEEKLY');
  const [interval, setInterval] = useState('1');
  const [byWeekday, setByWeekday] = useState<Weekday[]>(['MO']);
  const [byMonthDay, setByMonthDay] = useState('1');
  const [durationValue, setDurationValue] = useState('6');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('MONTHS');

  // Paso 3
  const [preview, setPreview] = useState<BulkPreviewResponse | null>(null);
  const [skipConflicts, setSkipConflicts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    roomsApi.getAll().then(setRooms);
  }, []);

  const endSlots = allSlots
    .filter((s) => timeToMinutes(s) > timeToMinutes(startTime))
    .concat('18:00')
    .filter((v, i, a) => a.indexOf(v) === i);

  const toggleWeekday = (d: Weekday) => {
    setByWeekday((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  const buildPayload = (): PreviewBulkPayload | null => {
    if (!roomId) {
      setError('Selecciona una sala');
      return null;
    }
    const att = parseInt(attendees);
    if (isNaN(att) || att < 1) {
      setError('Cantidad de personas inválida');
      return null;
    }
    const dur = parseInt(durationValue);
    if (isNaN(dur) || dur < 1) {
      setError('Duración inválida');
      return null;
    }

    const effFrequency: Frequency = mode === 'simple' ? 'WEEKLY' : frequency;
    const payload: PreviewBulkPayload = {
      roomId: Number(roomId),
      startDate,
      startTime,
      endTime,
      frequency: effFrequency,
      interval: mode === 'simple' ? 1 : Math.max(1, parseInt(interval) || 1),
      durationValue: dur,
      durationUnit,
      attendees: att,
    };

    if (effFrequency === 'WEEKLY') {
      if (byWeekday.length === 0) {
        setError('Selecciona al menos un día de la semana');
        return null;
      }
      payload.byWeekday = byWeekday;
    }
    if (effFrequency === 'MONTHLY') {
      payload.byMonthDay = Math.min(31, Math.max(1, parseInt(byMonthDay) || 1));
    }
    return payload;
  };

  const handlePreview = async () => {
    setError('');
    const payload = buildPayload();
    if (!payload) return;
    setLoading(true);
    try {
      const res = await adminApi.previewBulk(payload);
      setPreview(res);
      setStep('preview');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al generar la vista previa');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    const payload = buildPayload();
    if (!payload) return;
    if (!requesterName.trim() || requesterName.trim().length < 3) {
      setError('El nombre del solicitante es requerido (mín. 3 caracteres)');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Correo electrónico inválido');
      return;
    }
    if (phone.trim().length < 8) {
      setError('Número de teléfono inválido');
      return;
    }
    setLoading(true);
    try {
      const res = await adminApi.createBulk({
        ...payload,
        requesterName: requesterName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        topic: topic.trim() || undefined,
        skipConflicts,
      });
      setCreatedCount(res.createdCount);
      setStep('success');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Error al crear la serie. Revisa los conflictos e intenta de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={step !== 'success' ? onClose : undefined}
      />
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <Repeat className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-blue-100 text-xs font-medium">Reserva masiva</p>
                  <h2 className="text-white font-bold text-lg leading-tight">
                    Serie de reservas recurrentes
                  </h2>
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
            {step !== 'success' && (
              <div className="mt-4 flex items-center gap-2">
                {(['basics', 'recurrence', 'preview'] as Step[]).map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      ['basics', 'recurrence', 'preview'].indexOf(step) >= i
                        ? 'bg-white'
                        : 'bg-white/25'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* STEP 1: BASICS */}
          {step === 'basics' && (
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sala</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value ? Number(e.target.value) : '')}
                    className={inputCls}
                  >
                    <option value="">Selecciona una sala</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Inicia el
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={startDate}
                      min={todayISO()}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Hora inicio
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className={inputCls}
                    >
                      {allSlots.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Hora fin
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className={inputCls}
                    >
                      {endSlots.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Nombre del solicitante
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      placeholder="Juan Pérez García"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Correo</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="juan.perez@empresa.com"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+504 9999-8888"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Cantidad de personas
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min={1}
                      value={attendees}
                      onChange={(e) => setAttendees(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Tema <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="Reunión semanal de equipo..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setError('');
                    setStep('recurrence');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center gap-2"
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: RECURRENCE */}
          {step === 'recurrence' && (
            <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
                {(['simple', 'advanced'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      mode === m
                        ? 'bg-white text-blue-700 shadow'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {m === 'simple' ? 'Simple' : 'Avanzado'}
                  </button>
                ))}
              </div>

              {mode === 'simple' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Repetir los días
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((d) => (
                        <button
                          key={d.key}
                          onClick={() => toggleWeekday(d.key)}
                          className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                            byWeekday.includes(d.key)
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mode === 'advanced' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Frecuencia
                      </label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as Frequency)}
                        className="w-full px-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none"
                      >
                        <option value="DAILY">Diaria</option>
                        <option value="WEEKLY">Semanal</option>
                        <option value="MONTHLY">Mensual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Cada (intervalo)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  {frequency === 'WEEKLY' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Días de la semana
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((d) => (
                          <button
                            key={d.key}
                            onClick={() => toggleWeekday(d.key)}
                            className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                              byWeekday.includes(d.key)
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {frequency === 'MONTHLY' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Día del mes
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={byMonthDay}
                        onChange={(e) => setByMonthDay(e.target.value)}
                        className="w-32 px-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Repetir durante
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    value={durationValue}
                    onChange={(e) => setDurationValue(e.target.value)}
                    className="w-24 px-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none"
                  />
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                    className="px-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none"
                  >
                    {DURATION_UNITS.map((u) => (
                      <option key={u.key} value={u.key}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  A partir del {formatDate(startDate)}, {startTime}–{endTime}.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => {
                    setError('');
                    setStep('basics');
                  }}
                  className="px-5 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-gray-300 transition-all flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Atrás
                </button>
                <button
                  onClick={handlePreview}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Ver fechas <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 'preview' && preview && (
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-green-600 uppercase">Disponibles</p>
                  <p className="text-2xl font-bold text-green-700">{preview.summary.ok}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-600 uppercase">Conflictos</p>
                  <p className="text-2xl font-bold text-red-700">{preview.summary.conflicts}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-600 uppercase">Fin de sem.</p>
                  <p className="text-2xl font-bold text-amber-700">{preview.summary.weekend}</p>
                </div>
                <div className="bg-gray-100 border border-gray-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Otras</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {preview.summary.outOfHours + preview.summary.past}
                  </p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">
                          Fecha
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">
                          Horario
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.dates.map((d) => (
                        <tr key={d.date} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2 text-gray-700">{formatDate(d.date)}</td>
                          <td className="px-4 py-2 text-gray-600">
                            {preview.startTime} — {preview.endTime}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${
                                STATUS_STYLE[d.status].cls
                              }`}
                              title={d.reason}
                            >
                              {STATUS_STYLE[d.status].label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {preview.summary.ok === 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                  <CalendarX className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">
                    No hay fechas disponibles. Ajusta la recurrencia o el rango.
                  </p>
                </div>
              )}

              {preview.summary.ok > 0 &&
                preview.totalDates - preview.summary.ok > 0 && (
                  <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipConflicts}
                      onChange={(e) => setSkipConflicts(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-blue-600"
                    />
                    <span className="text-sm text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      Omitir las {preview.totalDates - preview.summary.ok} fechas no
                      disponibles y crear solo las {preview.summary.ok} válidas.
                    </span>
                  </label>
                )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => {
                    setError('');
                    setStep('recurrence');
                  }}
                  className="px-5 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-gray-300 transition-all flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Atrás
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading || preview.summary.ok === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    `Crear serie (${preview.summary.ok})`
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Serie creada</h3>
              <p className="text-sm text-gray-500 mb-6">
                Se crearon <strong>{createdCount}</strong> reservas confirmadas y se envió un
                correo de resumen al solicitante.
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
