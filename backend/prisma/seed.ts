import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Crear salas
  const rooms = [
    { name: 'Comedor', description: 'Sala de reuniones en el comedor principal', minAttendees: null },
    { name: 'Sala Joel Osorto', description: 'Sala de conferencias Joel Osorto', minAttendees: 10 },
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { name: room.name },
      update: { minAttendees: room.minAttendees },
      create: room,
    });
    console.log(`Sala creada/existente: ${room.name}`);
  }

  // Crear admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@empresa.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const hashed = await bcrypt.hash(adminPassword, 12);

  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashed,
    },
  });

  console.log(`Admin creado: ${adminEmail}`);
  console.log('Seed completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
