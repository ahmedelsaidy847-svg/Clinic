import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ===== إعداد العيادة عبر متغيّرات البيئة (لكل عيادة جديدة قيَم مختلفة) =====
// لو غير محددة، تُستخدم القيم الافتراضية. غيّرها في .env أو في Vercel.
const CLINIC_NAME = process.env.CLINIC_NAME || "Smart Clinic";
const CLINIC_PHONE = process.env.CLINIC_PHONE || "";
const CLINIC_ADDRESS = process.env.CLINIC_ADDRESS || "";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@clinic.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_NAME = process.env.ADMIN_NAME || "مدير النظام";

// بيانات تجريبية (طبيب + مرضى تجريبيون) — أطفئها للعيادة الحقيقية بـ SEED_DEMO=false
const SEED_DEMO = (process.env.SEED_DEMO ?? "true").toLowerCase() !== "false";

async function main() {
  console.log("🌱 Seeding database...");

  // إعدادات العيادة (سجل واحد ثابت id=clinic)
  await db.clinicSettings.upsert({
    where: { id: "clinic" },
    update: { name: CLINIC_NAME, phone: CLINIC_PHONE || null, address: CLINIC_ADDRESS || null },
    create: {
      id: "clinic",
      name: CLINIC_NAME,
      phone: CLINIC_PHONE || null,
      address: CLINIC_ADDRESS || null,
    },
  });

  // الفرع الرئيسي
  const branch = await db.branch.upsert({
    where: { id: "main-branch" },
    update: {},
    create: {
      id: "main-branch",
      name: "الفرع الرئيسي",
      address: CLINIC_ADDRESS || "—",
      phone: CLINIC_PHONE || "",
    },
  });

  // حساب المدير (الأدمن) — يُنشأ مرة واحدة؛ كلمة المرور تُحدَّث دائماً من البيئة
  const adminPass = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: adminPass, name: ADMIN_NAME, role: "ADMIN", isActive: true },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash: adminPass,
      role: "ADMIN",
      branchId: branch.id,
    },
  });

  // إجراءات شائعة بأسعارها (مفيدة كنقطة بداية لأي عيادة)
  const procedures = [
    { name: "كشف", price: 200 },
    { name: "حشو عصب", price: 1500 },
    { name: "خلع", price: 500 },
    { name: "تنظيف وتلميع", price: 600 },
    { name: "حشو ضوئي", price: 700 },
  ];
  for (const p of procedures) {
    const existing = await db.procedure.findFirst({ where: { name: p.name } });
    if (!existing) await db.procedure.create({ data: p });
  }

  // بيانات تجريبية (اختيارية)
  if (SEED_DEMO) {
    const docPass = await bcrypt.hash("doctor123", 10);
    const docUser = await db.user.upsert({
      where: { email: "doctor@clinic.com" },
      update: {},
      create: {
        name: "أحمد محمد",
        email: "doctor@clinic.com",
        passwordHash: docPass,
        role: "DOCTOR",
        branchId: branch.id,
      },
    });
    await db.doctor.upsert({
      where: { userId: docUser.id },
      update: {},
      create: { userId: docUser.id, specialty: "أسنان عام", branchId: branch.id },
    });

    const samplePatients = [
      { code: "P-00001", firstName: "سارة", lastName: "علي", phone: "01000000001", gender: "FEMALE" as const },
      { code: "P-00002", firstName: "محمود", lastName: "حسن", phone: "01000000002", gender: "MALE" as const },
    ];
    for (const p of samplePatients) {
      await db.patient.upsert({ where: { code: p.code }, update: {}, create: p });
    }
  }

  console.log("✅ Seed done.");
  console.log(`   Clinic: ${CLINIC_NAME}`);
  console.log(`   Admin:  ${ADMIN_EMAIL}`);
  if (SEED_DEMO) console.log("   Demo:   doctor@clinic.com / doctor123 (+ مرضى تجريبيون)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
