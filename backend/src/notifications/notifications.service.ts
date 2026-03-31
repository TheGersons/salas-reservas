import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { Reservation, Room } from "@prisma/client";

type ReservationWithRoom = Reservation & { room: Room };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: "smtppro.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("es-HN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  private baseTemplate(
    title: string,
    accentColor: string,
    content: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#1e40af);padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Energía PD</p>
                    <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">${title}</h1>
                  </td>
                  <td align="right">
                    <div style="width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;">
                      <span style="color:#ffffff;font-size:22px;">&#128197;</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                Sistema de Reservas de Salas — Energía PD<br>
                Este es un correo automatico, por favor no responder.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private reservationBlock(reservation: ReservationWithRoom): string {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:10px;margin:20px 0;">
        <tr>
          <td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid #dbeafe;">
                  <span style="color:#64748b;font-size:13px;">Sala</span>
                  <span style="float:right;color:#1e40af;font-weight:600;font-size:13px;">${reservation.room.name}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid #dbeafe;">
                  <span style="color:#64748b;font-size:13px;">Fecha</span>
                  <span style="float:right;color:#1e3a8a;font-weight:600;font-size:13px;">${this.formatDate(reservation.date)}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid #dbeafe;">
                  <span style="color:#64748b;font-size:13px;">Horario</span>
                  <span style="float:right;color:#1e3a8a;font-weight:600;font-size:13px;">${reservation.startTime} — ${reservation.endTime}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;">
                  <span style="color:#64748b;font-size:13px;">Solicitante</span>
                  <span style="float:right;color:#1e3a8a;font-weight:600;font-size:13px;">${reservation.requesterName}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
  }

  // ─── Correo: Reserva recibida ────────────────────────
  async sendReservationReceived(reservation: ReservationWithRoom) {
    const content = `
      <p style="color:#374151;font-size:16px;margin:0 0 4px;">Hola, <strong>${reservation.requesterName}</strong></p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Hemos recibido tu solicitud de reserva. El administrador la revisara pronto.</p>
      ${this.reservationBlock(reservation)}
      <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">Te notificaremos cuando tu reserva sea confirmada o si existe algun inconveniente.</p>`;

    const adminContent = `
  <p style="color:#374151;font-size:16px;margin:0 0 4px;">Nueva solicitud recibida</p>
  <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Se ha registrado una nueva solicitud de reserva que requiere tu revisión.</p>
  ${this.reservationBlock(reservation)}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
    <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Correo</td><td style="padding:4px 0;color:#1e40af;font-size:13px;font-weight:600;text-align:right;">${reservation.email}</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Teléfono</td><td style="padding:4px 0;color:#1e40af;font-size:13px;font-weight:600;text-align:right;">${reservation.phone}</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Personas</td><td style="padding:4px 0;color:#1e40af;font-size:13px;font-weight:600;text-align:right;">${reservation.attendees}</td></tr>
    ${reservation.topic ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Tema</td><td style="padding:4px 0;color:#1e40af;font-size:13px;font-weight:600;text-align:right;">${reservation.topic}</td></tr>` : ''}
  </table>
  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin" style="display:inline-block;margin-top:16px;background:#1d4ed8;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">Revisar en el panel</a>`;

    await Promise.all([
      this.send(
        reservation.email,
        "Solicitud de sala recibida",
        this.baseTemplate("Solicitud Recibida", "#3b82f6", content),
      ),
      this.send(
        process.env.ADMIN_NOTIFICATION_EMAIL ?? '',
        `Nueva solicitud de sala — ${reservation.room.name}`,
        this.baseTemplate("Nueva solicitud recibida", "#1d4ed8", adminContent),
      ),
    ]);
  }

  // ─── Correo: Confirmacion ────────────────────────────
  async sendConfirmation(reservation: ReservationWithRoom) {
    const content = `
      <p style="color:#374151;font-size:16px;margin:0 0 4px;">Hola, <strong>${reservation.requesterName}</strong></p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Tu reserva ha sido <strong style="color:#16a34a;">confirmada</strong>. Nos vemos pronto.</p>
      ${this.reservationBlock(reservation)}
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-top:16px;">
        <p style="margin:0;color:#15803d;font-size:13px;">Tu reunión esta confirmada. Por favor llega con 5 minutos de anticipacion.</p>
      </div>`;

    await this.send(
      reservation.email,
      "Sala confirmada",
      this.baseTemplate("Reserva Confirmada", "#22c55e", content),
    );
  }

  // ─── Correo: Cancelacion ────────────────────────────
  async sendCancellation(reservation: ReservationWithRoom) {
    const content = `
      <p style="color:#374151;font-size:16px;margin:0 0 4px;">Hola, <strong>${reservation.requesterName}</strong></p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Lamentamos informarte que tu reserva ha sido <strong style="color:#dc2626;">cancelada</strong>.</p>
      ${this.reservationBlock(reservation)}
      <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">Si tienes dudas, comunicate con el administrador del sistema.</p>`;

    await this.send(
      reservation.email,
      "Reserva cancelada",
      this.baseTemplate("Reserva Cancelada", "#ef4444", content),
    );
  }

  // ─── Correo: Recordatorio ───────────────────────────
  async sendReminder(
    reservation: ReservationWithRoom,
    type: "REMINDER_60" | "REMINDER_30" | "REMINDER_15" | "CUSTOM",
  ) {
    const messages: Record<string, { label: string; detail: string }> = {
      REMINDER_60: {
        label: "en 1 hora",
        detail: "Tu reunion comienza en aproximadamente 1 hora.",
      },
      REMINDER_30: {
        label: "en 30 minutos",
        detail: "Tu reunion comienza en 30 minutos. Prepara lo que necesitas.",
      },
      REMINDER_15: {
        label: "en 15 minutos",
        detail:
          "Tu reunion comienza en 15 minutos. Ya es momento de dirigirte a la sala.",
      },
      CUSTOM: {
        label: "pronto",
        detail: "Este es un recordatorio de tu proxima reunion.",
      },
    };

    const { label, detail } = messages[type];

    const content = `
      <p style="color:#374151;font-size:16px;margin:0 0 4px;">Hola, <strong>${reservation.requesterName}</strong></p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Te recordamos que tu reunion comienza <strong style="color:#1d4ed8;">${label}</strong>.</p>
      ${this.reservationBlock(reservation)}
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin-top:16px;">
        <p style="margin:0;color:#1e40af;font-size:13px;">${detail}</p>
      </div>`;

    await this.send(
      reservation.email,
      `Recordatorio: Tu reunion comienza ${label}`,
      this.baseTemplate(`Recordatorio — ${label}`, "#3b82f6", content),
    );
  }

  // ─── Enviar correo ───────────────────────────────────
  private async send(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: `"Sistema de Salas - Energía PD" <${process.env.MAIL_USER}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`Correo enviado a ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Error enviando correo a ${to}: ${error.message}`);
      // No lanzar excepcion para no interrumpir el flujo principal
    }
  }
}
