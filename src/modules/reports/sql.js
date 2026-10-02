const { prisma } = require("../../config/prisma");
// `raw` is the SQL-fragment helper exported by the generated Prisma client.
const { raw } = require("../../generated/prisma/client");

/**
 * SQL implementations of the aggregating reports.
 *
 * These replace the previous `aggregate()` path, which loaded whole tables
 * into Node and reduced them in JavaScript. Grouping, summing and period
 * bucketing now happen in PostgreSQL, so report cost no longer grows with the
 * amount of data returned to the application process.
 *
 * Every query mirrors the previous pipeline exactly, including sort order and
 * the fields the API returns, so responses are unchanged.
 *
 * Notes on fidelity:
 *  - Period bucketing uses `date_trunc` in UTC, matching the previous
 *    `$dateToString` formatting ("%Y-%m" / "%Y-%m-%d").
 *  - Money is summed as NUMERIC(14,2) and cast to float8 on output, matching
 *    the numeric JSON the API emitted before.
 *  - `avgResolutionHours` is averaged in SQL but rounded in JS with toFixed(2)
 *    so the value is bit-for-bit the same as the previous calculation.
 */

/** "YYYY-MM" for monthly buckets, "YYYY-MM-DD" for daily. */
const periodExpr = (column, interval) =>
  interval === "daily"
    ? `to_char(date_trunc('day', ${column}), 'YYYY-MM-DD')`
    : `to_char(date_trunc('month', ${column}), 'YYYY-MM')`;

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

/** Completed payments grouped by period. */
async function collection({ start, end, interval }) {
  const rows = await prisma.$queryRaw`
    SELECT ${raw(periodExpr('"createdAt"', interval))} AS period,
           COALESCE(SUM(amount), 0)::float8 AS amount,
           COUNT(*)::int AS count
    FROM payments
    WHERE status = 'Completed'
      AND "createdAt" >= ${start}::timestamptz
      AND "createdAt" <= ${end}::timestamptz
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  const data = rows.map((r) => ({ period: r.period, amount: toNumber(r.amount), count: r.count }));
  return { data, total: data.reduce((sum, r) => sum + r.amount, 0) };
}

/** Outstanding installment balances grouped by status. */
async function dues({ start, end }) {
  const rows = await prisma.$queryRaw`
    SELECT status,
           COALESCE(SUM(balance), 0)::float8 AS amount,
           COUNT(*)::int AS count
    FROM installments
    WHERE balance > 0
      AND "dueDate" >= ${start}::timestamptz
      AND "dueDate" <= ${end}::timestamptz
    GROUP BY status
    ORDER BY status ASC
  `;
  const data = rows.map((r) => ({ status: r.status, amount: toNumber(r.amount), count: r.count }));
  return { data, total: data.reduce((sum, r) => sum + r.amount, 0) };
}

/**
 * Overdue balances per member, worst first, joined to the member for the
 * display name and membership number. LEFT JOIN keeps a defaulter row even if
 * the member record is missing, matching the previous `|| "Unknown"` fallback.
 */
async function defaulters({ start, end }) {
  const rows = await prisma.$queryRaw`
    SELECT i.member AS "memberId",
           m.name    AS "memberName",
           m."memberId" AS "memberNumber",
           COALESCE(SUM(i.balance), 0)::float8 AS "overdueAmount",
           COUNT(*)::int AS installments
    FROM installments i
    LEFT JOIN members m ON m.id = i.member
    WHERE i.balance > 0
      AND i."dueDate" >= ${start}::timestamptz
      AND i."dueDate" <= ${end}::timestamptz
      AND i."dueDate" < NOW()
    GROUP BY i.member, m.name, m."memberId"
    ORDER BY "overdueAmount" DESC
  `;
  const data = rows.map((r) => ({
    memberId: r.memberId,
    memberName: r.memberName || "Unknown",
    memberNumber: r.memberNumber || "—",
    overdueAmount: toNumber(r.overdueAmount),
    installments: r.installments,
  }));
  return { data, total: data.reduce((sum, r) => sum + r.overdueAmount, 0) };
}

/** Completed income and paid expenses per period, merged into one timeline. */
async function incomeExpense({ start, end, interval }) {
  const period = periodExpr('"createdAt"', interval);
  const expensePeriod = periodExpr("date", interval);
  const [incomeRows, expenseRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT ${raw(period)} AS period,
             COALESCE(SUM(amount), 0)::float8 AS amount
      FROM payments
      WHERE status = 'Completed'
        AND "createdAt" >= ${start}::timestamptz
        AND "createdAt" <= ${end}::timestamptz
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw`
      SELECT ${raw(expensePeriod)} AS period,
             COALESCE(SUM(amount), 0)::float8 AS amount
      FROM expenses
      WHERE status = 'Paid'
        AND date >= ${start}::timestamptz
        AND date <= ${end}::timestamptz
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const income = incomeRows.map((r) => ({ period: r.period, amount: toNumber(r.amount) }));
  const expense = expenseRows.map((r) => ({ period: r.period, amount: toNumber(r.amount) }));

  // The two timelines are merged in JS, exactly as before: the number of
  // periods is small and bounded by the date range.
  const periods = new Map();
  for (const row of income) periods.set(row.period, { period: row.period, income: row.amount, expense: 0 });
  for (const row of expense) {
    periods.set(row.period, {
      period: row.period,
      income: periods.get(row.period)?.income || 0,
      expense: row.amount,
    });
  }
  const data = Array.from(periods.values()).sort((a, b) => a.period.localeCompare(b.period));
  return {
    data,
    totals: {
      income: data.reduce((sum, r) => sum + r.income, 0),
      expense: data.reduce((sum, r) => sum + r.expense, 0),
    },
  };
}

/** Refund requests grouped by status. */
async function refunds({ start, end }) {
  const rows = await prisma.$queryRaw`
    SELECT status,
           COALESCE(SUM(amount), 0)::float8 AS amount,
           COUNT(*)::int AS count
    FROM refunds
    WHERE "createdAt" >= ${start}::timestamptz
      AND "createdAt" <= ${end}::timestamptz
    GROUP BY status
    ORDER BY status ASC
  `;
  const data = rows.map((r) => ({ status: r.status, amount: toNumber(r.amount), count: r.count }));
  return { data, total: data.reduce((sum, r) => sum + r.amount, 0) };
}

/**
 * Complaint volume, SLA breaches and resolution performance.
 * Returns the grouped counts plus the open/overdue/resolved tallies and the
 * average resolution time in hours.
 */
async function complaints({ start, end }) {
  const hasRange = Boolean(start && end);
  const { OPEN_STATUSES } = require("../complaints/complaint.config");

  // Two explicit variants rather than splicing SQL fragments, so the date
  // filter is always a bound parameter.
  const ranged = hasRange
    ? await prisma.$queryRaw`
        SELECT
          (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
              SELECT status, COUNT(*)::int AS count FROM complaints
              WHERE "createdAt" >= ${start}::timestamptz AND "createdAt" <= ${end}::timestamptz
              GROUP BY status ORDER BY status ASC
           ) t) AS "byStatus",
          (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
              SELECT category, COUNT(*)::int AS count FROM complaints
              WHERE "createdAt" >= ${start}::timestamptz AND "createdAt" <= ${end}::timestamptz
              GROUP BY category ORDER BY count DESC
           ) t) AS "byCategory",
          (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
              SELECT "assignedDepartment" AS "departmentId", COUNT(*)::int AS count FROM complaints
              WHERE "createdAt" >= ${start}::timestamptz AND "createdAt" <= ${end}::timestamptz
              GROUP BY "assignedDepartment" ORDER BY count DESC
           ) t) AS "byDepartment",
          (SELECT COUNT(*)::int FROM complaints
            WHERE status = ANY(${OPEN_STATUSES}::text[]) AND "slaDueDate" < NOW())::int AS overdue,
          (SELECT COUNT(*)::int FROM complaints
            WHERE status = 'Resolved' AND "resolvedAt" IS NOT NULL
              AND "createdAt" >= ${start}::timestamptz AND "createdAt" <= ${end}::timestamptz)::int AS resolved,
          (SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600.0) FROM complaints
            WHERE status = 'Resolved' AND "resolvedAt" IS NOT NULL
              AND "createdAt" >= ${start}::timestamptz AND "createdAt" <= ${end}::timestamptz)::float8 AS "avgHours"
      `
    : await prisma.$queryRaw`
        SELECT
          (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
              SELECT status, COUNT(*)::int AS count FROM complaints
              GROUP BY status ORDER BY status ASC
           ) t) AS "byStatus",
          (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
              SELECT category, COUNT(*)::int AS count FROM complaints
              GROUP BY category ORDER BY count DESC
           ) t) AS "byCategory",
          (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
              SELECT "assignedDepartment" AS "departmentId", COUNT(*)::int AS count FROM complaints
              GROUP BY "assignedDepartment" ORDER BY count DESC
           ) t) AS "byDepartment",
          (SELECT COUNT(*)::int FROM complaints
            WHERE status = ANY(${OPEN_STATUSES}::text[]) AND "slaDueDate" < NOW())::int AS overdue,
          (SELECT COUNT(*)::int FROM complaints
            WHERE status = 'Resolved' AND "resolvedAt" IS NOT NULL)::int AS resolved,
          (SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600.0) FROM complaints
            WHERE status = 'Resolved' AND "resolvedAt" IS NOT NULL)::float8 AS "avgHours"
      `;

  const row = ranged[0] || {};
  const statusCounts = row.byStatus || [];
  const total = statusCounts.reduce((sum, r) => sum + r.count, 0);
  const open = statusCounts
    .filter((r) => OPEN_STATUSES.includes(r.status))
    .reduce((sum, r) => sum + r.count, 0);

  return {
    total,
    open,
    overdue: row.overdue || 0,
    resolved: row.resolved || 0,
    // Rounded in JS to keep the exact previous toFixed(2) behaviour.
    avgResolutionTimeHours:
      row.avgHours === null || row.avgHours === undefined
        ? null
        : Number(Number(row.avgHours).toFixed(2)),
    byStatus: statusCounts.map((r) => ({ status: r.status, count: r.count })),
    byCategory: (row.byCategory || []).map((r) => ({ category: r.category, count: r.count })),
    byDepartment: (row.byDepartment || []).map((r) => ({
      departmentId: r.departmentId || null,
      departmentName: null, // filled in by the caller, which owns the lookup
      count: r.count,
    })),
  };
}

/**
 * Occupancy grouped by block.
 *
 * The previous version loaded every plot and every block into Node and
 * reduced in JavaScript. It returns one row per block, so it maps directly to
 * a GROUP BY with no per-row payload at all.
 */
async function occupancy() {
  const rows = await prisma.$queryRaw`
    SELECT COALESCE(b.name, 'Unassigned') AS block,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE p."currentOwner" IS NOT NULL)::int AS occupied,
           COUNT(*) FILTER (WHERE p.status = 'Available')::int AS available,
           COUNT(*) FILTER (WHERE p.status = 'Reserved')::int AS reserved
    FROM plots p
    LEFT JOIN blocks b ON b.id = p.block
    GROUP BY COALESCE(b.name, 'Unassigned')
    ORDER BY block ASC
  `;
  const data = rows.map((r) => ({
    block: r.block,
    total: r.total,
    occupied: r.occupied,
    available: r.available,
    reserved: r.reserved,
    occupancyRate: r.total ? Number(((r.occupied / r.total) * 100).toFixed(1)) : 0,
  }));
  const [summary] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE "currentOwner" IS NOT NULL)::int AS occupied,
           COUNT(*) FILTER (WHERE status = 'Available')::int AS available
    FROM plots
  `;
  return { data, summary: { totalPlots: summary.total, occupied: summary.occupied, available: summary.available } };
}

/**
 * Staff workload per employee.
 *
 * Replaces four full table loads plus nested JS filtering (an N x M scan) with
 * correlated aggregates computed in PostgreSQL.
 */
async function staffPerformance({ start, end }) {
  const rows = await prisma.$queryRaw`
    SELECT e."employeeId"   AS "employeeId",
           e.name           AS name,
           e.department     AS department,
           e.designation    AS designation,
           COALESCE(a.present, 0)::int AS present,
           COALESCE(a.absent, 0)::int  AS absent,
           COALESCE(l.leaves, 0)::int  AS "leaveRequests",
           COALESCE(w.assigned, 0)::int AS "assignedWorkOrders",
           COALESCE(w.open, 0)::int    AS "openWorkOrders"
    FROM employees e
    LEFT JOIN (
        SELECT employee,
               COUNT(*) FILTER (WHERE status = 'Present')::int AS present,
               COUNT(*) FILTER (WHERE status = 'Absent')::int  AS absent
        FROM attendance
        WHERE date >= ${start}::timestamptz AND date <= ${end}::timestamptz
        GROUP BY employee
    ) a ON a.employee = e.id
    LEFT JOIN (
        SELECT employee, COUNT(*)::int AS leaves
        FROM leave_requests
        WHERE "createdAt" >= ${start}::timestamptz AND "createdAt" <= ${end}::timestamptz
        GROUP BY employee
    ) l ON l.employee = e.id
    LEFT JOIN (
        SELECT "assignedStaff" AS employee,
               COUNT(*)::int AS assigned,
               COUNT(*) FILTER (WHERE status IN ('Open','InProgress'))::int AS open
        FROM work_orders
        GROUP BY "assignedStaff"
    ) w ON w.employee = e.id
    ORDER BY e.name ASC
  `;
  return {
    data: rows.map((r) => ({
      employeeId: r.employeeId,
      name: r.name,
      department: r.department,
      designation: r.designation,
      present: r.present,
      absent: r.absent,
      leaveRequests: r.leaveRequests,
      assignedWorkOrders: r.assignedWorkOrders,
      openWorkOrders: r.openWorkOrders,
    })),
    total: rows.length,
  };
}

module.exports = {
  collection,
  dues,
  defaulters,
  incomeExpense,
  refunds,
  complaints,
  occupancy,
  staffPerformance,
  periodExpr,
};
