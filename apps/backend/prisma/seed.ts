import { PrismaClient, SessionStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Jeevandata database...');

  // ─── Create Clinic Users ─────────────────────────────────────
  const doctor = await prisma.clinicUser.upsert({
    where: { email: 'doctor@jeevandata.com' },
    update: {},
    create: {
      email: 'doctor@jeevandata.com',
      passwordHash: '$2b$10$placeholder_hash', // Replace with real hash
      name: 'Dr. Priya Sharma',
      role: UserRole.DOCTOR,
      clinicId: 'clinic-001',
    },
  });

  const receptionist = await prisma.clinicUser.upsert({
    where: { email: 'reception@jeevandata.com' },
    update: {},
    create: {
      email: 'reception@jeevandata.com',
      passwordHash: '$2b$10$placeholder_hash',
      name: 'Anita Verma',
      role: UserRole.RECEPTIONIST,
      clinicId: 'clinic-001',
    },
  });

  // ─── Create Sample Patients ──────────────────────────────────
  const patient1 = await prisma.patient.upsert({
    where: { mobile: '+919876543210' },
    update: {},
    create: {
      name: 'Rajesh Kumar',
      dob: new Date('1985-06-15'),
      mobile: '+919876543210',
      consentGranted: true,
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { mobile: '+919876543211' },
    update: {},
    create: {
      name: 'Sunita Patel',
      dob: new Date('1992-11-23'),
      mobile: '+919876543211',
      consentGranted: true,
    },
  });

  console.log(`  ✓ Created users: ${doctor.name}, ${receptionist.name}`);
  console.log(`  ✓ Created patients: ${patient1.name}, ${patient2.name}`);

  // ─── Create Sample Finished Session ──────────────────────────
  const session = await prisma.intakeSession.create({
    data: {
      patientId: patient1.id,
      status: SessionStatus.COMPLETED,
      deviceId: 'camera-001',
      metadata: { camera: 'main-entrance' },
      endedAt: new Date(),
    },
  });

  await prisma.intakeRecord.create({
    data: {
      sessionId: session.id,
      patientId: patient1.id,
      brief: {
        summary:
          'Patient presents with persistent headache and mild fever for 3 days. No emergency symptoms detected.',
        chiefComplaint: 'Headache and fever',
        riskFlags: [],
        vitalsToCheck: ['Blood Pressure', 'Temperature', 'Heart Rate'],
        suggestedFollowups: ['Duration of headache episodes', 'Any visual disturbances'],
        medicationsNote: 'No recent changes',
        icd10Hints: ['R51', 'R50.9'],
      },
      intakeData: {
        chiefComplaint: 'Headache and fever for 3 days',
        symptoms: [
          { name: 'Headache', duration: '3 days', severity: 6 },
          { name: 'Fever', duration: '3 days', severity: 5 },
        ],
        associated: ['Mild body ache', 'Fatigue'],
        medicationChanges: 'None',
        allergyUpdates: 'No known allergies',
        patientNotes: 'Patient seems anxious about work deadlines',
      },
    },
  });

  console.log(`  ✓ Created sample intake session for ${patient1.name}`);
  console.log('✅ Seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
