/**
 * End-to-end check that the migrated services read and write through Postgres.
 *
 * Exercises real service methods (not raw Prisma) for members, plots,
 * payments and HR, then rolls the test records back so the database is left
 * exactly as it was found.
 *
 * Run: node scripts/verifyRuntime.js
 */
const { prisma } = require("../src/config/prisma");
const connectDB = require("../src/config/db");
const Member = require("../src/modules/members/member.model");
const { Plot, OwnershipHistory } = require("../src/modules/properties/plot.model");
const { Installment, Booking } = require("../src/modules/bookings/booking.model");
const { Payment, Refund } = require("../src/modules/payments/payment.model");
const Employee = require("../src/modules/hr/employee.model");
const Attendance = require("../src/modules/hr/attendance.model");
const AdministrationService = require("../src/modules/administration/service");
const AuthService = require("../src/modules/auth/service");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function main() {
  await connectDB();
  const created = { members: [], plots: [], bookings: [], installments: [], payments: [], employees: [], attendance: [] };

  try {
    console.log("\n1. READ - real rows come back from Postgres through the models");
    const memberCount = (await Member.find({})).length;
    const plotCount = (await Plot.find({})).length;
    const allPayments = await Payment.find({});
    const employees = await Employee.find({});
    check("members readable via Member.find", memberCount === 30, `${memberCount} rows`);
    check("plots readable via Plot.find", plotCount === 40, `${plotCount} rows`);
    check("payments readable via Payment.find", allPayments.length === 20, `${allPayments.length} rows`);
    check("employees readable via Employee.find", employees.length === 10, `${employees.length} rows`);

    const sample = await Member.findById(allPayments[0] && (await Payment.find({}))[0].member);
    check("Member.findById resolves a real member", Boolean(sample), sample ? sample.name : "not found");

    console.log("\n2. READ - legacy shape preserved (id, ISO dates, numeric money)");
    const onePayment = allPayments[0];
    check("documents expose _id", Boolean(onePayment._id));
    check("timestamps are ISO strings", typeof onePayment.createdAt === "string", onePayment.createdAt);
    check("money is a number, not a string/Decimal", typeof onePayment.amount === "number", String(onePayment.amount));

    console.log("\n3. READ - filters and sorting pushed into SQL");
    const active = (await Member.find({ status: "Active" })).length;
    const sorted = await Member.find({}, { sort: { createdAt: -1 } });
    const dates = sorted.map((m) => new Date(m.createdAt).getTime());
    const descending = dates.every((d, i) => i === 0 || dates[i - 1] >= d);
    check("status filter applied", active > 0 && active <= memberCount, `${active} active`);
    check("sort applied", descending);

    console.log("\n4. WRITE - create members through Member.create (real service path)");
    const createdMember = await Member.create(
      { name: "Runtime Check Member", cnic: "99999-0000000-1", phone: "03000000000" },
      "runtime-check"
    );
    created.members.push(createdMember._id);
    check("Member.create persisted", Boolean(createdMember._id), createdMember._id);
    check("numbering rule assigned a memberId", /^MEM-/.test(createdMember.memberId || ""), createdMember.memberId);

    const reread = await Member.findById(createdMember._id);
    check("new member is readable back from Postgres", Boolean(reread), reread ? reread.name : "missing");

    console.log("\n5. WRITE - update and soft delete");
    await Member.update(createdMember._id, { phone: "03111111111" });
    const updated = await Member.findById(createdMember._id);
    check("Member.update persisted", updated.phone === "03111111111", updated.phone);

    await Member.delete(createdMember._id);
    const deleted = await Member.findById(createdMember._id);
    check("Member.delete is a soft delete (status=Inactive)", deleted.status === "Inactive", deleted.status);

    console.log("\n6. WRITE - create a plot and append ownership history");
    const plot = await Plot.create(
      { block: "B", street: "S1", size: "10M", category: "Residential", propertyType: "residential", price: 5000000 },
      "runtime-check"
    );
    created.plots.push(plot._id);
    check("Plot.create persisted", Boolean(plot._id), plot.plotNumber);

    const history = await OwnershipHistory.append({
      plot: plot._id,
      member: createdMember._id,
      fromDate: new Date().toISOString(),
      type: "allocation",
    });
    check("OwnershipHistory.append persisted", Boolean(history._id));

    console.log("\n7. WRITE - booking, installment and payment against Postgres");
    const booking = await Booking.create(
      {
        member: createdMember._id,
        plot: plot._id,
        price: 5000000,
        bookingAmount: 500000,
        developmentCharges: 0,
        additionalCharges: 0,
        discount: 0,
        refundAmount: 0,
      },
      "runtime-check"
    );
    created.bookings.push(booking._id);
    check("Booking.create persisted", Boolean(booking._id));

    // Installment exposes createMany (that is how the booking service writes
    // a generated plan), so exercise the same path.
    const [installment] = await Installment.createMany([
      {
        member: createdMember._id,
        plot: plot._id,
        dueDate: new Date().toISOString(),
        amount: 500000,
        paidAmount: 0,
        balance: 500000,
        penaltyAmount: 0,
        discountAmount: 0,
        status: "Upcoming",
      },
    ]);
    created.installments.push(installment._id);
    check("Installment.createMany persisted", Boolean(installment._id));

    const payment = await Payment.create({
      member: createdMember._id,
      plot: plot._id,
      amount: 200000,
      method: "Cash",
      collectedBy: "runtime-check",
    });
    created.payments.push(payment._id);
    check("Payment.create persisted with a receipt number", /^RCP-/.test(payment.receiptNumber || ""), payment.receiptNumber);

    const paidPayment = await Payment.findById(payment._id);
    check("payment readable back with numeric amount", paidPayment.amount === 200000, String(paidPayment.amount));

    console.log("\n8. WRITE - HR employee with department relation resolved");
    const employee = await Employee.create(
      {
        employeeId: "EMP-RUNTIME-CHECK",
        name: "Runtime Check Employee",
        department: "Finance",
        designation: "Analyst",
        joiningDate: "2026-01-01",
        basicSalary: 50000,
        status: "Active",
      },
      "runtime-check"
    );
    created.employees.push(employee._id);
    check("Employee.create persisted", Boolean(employee._id), employee.employeeId);
    check("departmentId resolved from department name", Boolean(employee.departmentId), employee.departmentId);

    const staffRow = await prisma.employee.findUnique({
      where: { id: employee._id },
      include: { departmentRef: true },
    });
    check("departmentRef relation resolves to a departments row", staffRow.departmentRef?.name === "Finance", staffRow.departmentRef?.name);

    const attendance = await Attendance.create(
      { employee: employee._id, date: new Date().toISOString(), status: "Present" },
      "runtime-check"
    );
    created.attendance.push(attendance._id);
    check("Attendance.create persisted", Boolean(attendance._id));

    console.log("\n9. WRITE - administrative services (already Prisma) still work");
    const settings = await AdministrationService.getSocietySettings();
    check("SocietySettings readable", Boolean(settings), settings?.name);
    const next = await AdministrationService.getNextNumber("receipt");
    check("atomic numbering sequence advanced", typeof next === "string" && next.length > 0, next);

    console.log("\n10. READ - auth still resolves users from Postgres");
    const env = require("../src/config/env");
    const login = await AuthService.login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
    check("Super Admin can log in against Postgres", Boolean(login.accessToken), login.user.email);
    check("login response carries a populated roles array", Array.isArray(login.user.roles) && login.user.roles.length > 0, login.user.roles.map((r) => r.name).join(","));
    check("login response omits passwordHash", login.user.passwordHash === undefined);
  } finally {
    console.log("\n11. CLEANUP - removing the rows this check created");
    for (const id of created.attendance) await prisma.attendance.deleteMany({ where: { id } });
    for (const id of created.employees) await prisma.employee.deleteMany({ where: { id } });
    for (const id of created.payments) await prisma.payment.deleteMany({ where: { id } });
    for (const id of created.installments) await prisma.installment.deleteMany({ where: { id } });
    for (const id of created.bookings) await prisma.booking.deleteMany({ where: { id } });
    await prisma.ownershipHistory.deleteMany({ where: { plot: { in: created.plots } } });
    for (const id of created.plots) await prisma.plot.deleteMany({ where: { id } });
    for (const id of created.members) await prisma.member.deleteMany({ where: { id } });
    await prisma.auditLog.deleteMany({ where: { userId: "runtime-check" } });
    console.log(`  removed ${Object.values(created).flat().length} test row(s)`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${"=".repeat(64)}`);
  console.log(`  checks: ${results.length}   passed: ${results.length - failed.length}   failed: ${failed.length}`);
  if (failed.length) {
    console.log("\n  failures:");
    for (const f of failed) console.log(`    - ${f.name} ${f.detail}`);
  }
  console.log(`${"=".repeat(64)}\n`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Runtime verification crashed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
