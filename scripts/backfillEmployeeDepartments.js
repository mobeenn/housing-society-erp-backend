/**
 * Resolve employees.departmentId from employees.department (a name) by
 * matching the departments table, and report anything that cannot be matched.
 *
 * Safe to re-run: only rows whose departmentId is still NULL are considered,
 * and a name that matches no department is left NULL on purpose (the API keeps
 * displaying the free-text name, so nothing breaks).
 *
 * Run: node scripts/backfillEmployeeDepartments.js
 */
const { prisma } = require("../src/config/prisma");

async function main() {
  const departments = await prisma.department.findMany({ select: { id: true, name: true } });
  const byName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d]));
  console.log(`departments: ${departments.length} -> ${departments.map((d) => d.name).join(", ")}`);

  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, department: true, departmentId: true },
  });

  let linked = 0;
  let alreadySet = 0;
  const unmatched = new Map();

  for (const employee of employees) {
    if (employee.departmentId) {
      alreadySet += 1;
      continue;
    }
    const key = String(employee.department || "").trim().toLowerCase();
    const department = key ? byName.get(key) : null;
    if (!department) {
      const label = employee.department || "(empty)";
      unmatched.set(label, (unmatched.get(label) || 0) + 1);
      continue;
    }
    await prisma.employee.update({
      where: { id: employee.id },
      data: { departmentId: department.id },
    });
    linked += 1;
  }

  console.log(`\nemployees: ${employees.length}`);
  console.log(`  already linked : ${alreadySet}`);
  console.log(`  newly linked   : ${linked}`);
  if (unmatched.size) {
    console.log(`  unmatched (departmentId left NULL, name still displayed):`);
    for (const [name, count] of unmatched) console.log(`    - "${name}" x${count}`);
  }

  const remaining = await prisma.employee.count({ where: { departmentId: null } });
  console.log(`\nverification: employees with NULL departmentId = ${remaining}`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
