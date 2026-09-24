const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const nonNegative = (value) => Math.max(0, number(value));

function daysInMonth(year, month) {
  return new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
}

function isWeekday(date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function workingDaysInMonth(year, month, fromDate = null) {
  const total = daysInMonth(year, month);
  let count = 0;
  for (let day = 1; day <= total; day += 1) {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, day));
    if (!isWeekday(date)) continue;
    if (fromDate) {
      const from = String(fromDate).slice(0, 10);
      const current = date.toISOString().slice(0, 10);
      if (current < from) continue;
    }
    count += 1;
  }
  return Math.max(1, count);
}

function attendanceProration(records = [], year, month, joiningDate = null) {
  const workingDays = workingDaysInMonth(year, month, joiningDate);
  const eligible = (records || []).filter((record) => {
    const value = String(record?.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month)) return false;
    if (!isWeekday(date)) return false;
    if (joiningDate && value < String(joiningDate).slice(0, 10)) return false;
    return true;
  });

  // Attendance is optional in the current HR workflow. Do not silently reduce
  // pay when only a few exception records have been entered; prorate only when
  // the employee's eligible working days are represented.
  if (eligible.length < workingDays) {
    return {
      factor: 1,
      presentDays: workingDays,
      workingDays,
      recordedDays: eligible.length,
      prorationApplied: false,
    };
  }

  const presentDays = eligible.reduce((sum, record) => {
    const status = String(record.status || "").toLowerCase();
    if (status === "present") return sum + 1;
    if (status === "half day" || status === "half-day") return sum + 0.5;
    if (status === "leave" || status === "holiday") return sum + 1;
    return sum;
  }, 0);
  const factor = Math.max(0, Math.min(1, presentDays / workingDays));
  return {
    factor: roundMoney(factor),
    presentDays: roundMoney(presentDays),
    workingDays,
    recordedDays: eligible.length,
    prorationApplied: true,
  };
}

function normalizeStructure(employee = {}) {
  const structure = Array.isArray(employee.salaryStructure) ? employee.salaryStructure : [];
  if (structure.length) {
    return structure
      .map((item) => ({
        component: String(item?.component || item?.name || "").trim(),
        amount: nonNegative(item?.amount),
      }))
      .filter((item) => item.component);
  }

  const fallback = [];
  if (nonNegative(employee.basicSalary) > 0) {
    fallback.push({ component: "Basic Salary", amount: nonNegative(employee.basicSalary) });
  }
  const allowances = employee.allowances;
  if (Array.isArray(allowances)) {
    allowances.forEach((item, index) => {
      const amount = typeof item === "object" ? nonNegative(item.amount) : nonNegative(item);
      if (amount > 0) fallback.push({ component: item?.name || `Allowance ${index + 1}`, amount });
    });
  } else if (allowances && typeof allowances === "object") {
    Object.entries(allowances).forEach(([name, amount]) => {
      if (nonNegative(amount) > 0) fallback.push({ component: name, amount: nonNegative(amount) });
    });
  } else if (nonNegative(allowances) > 0) {
    fallback.push({ component: "Allowance", amount: nonNegative(allowances) });
  }
  return fallback;
}

function componentDefinitions(setup = {}) {
  return Array.isArray(setup.salaryComponents) ? setup.salaryComponents : [];
}

function findDefinition(setup, name) {
  const normalized = String(name || "").trim().toLowerCase();
  return componentDefinitions(setup).find((item) => String(item.name || "").trim().toLowerCase() === normalized) || null;
}

function calculateComponents(employee, setup, factor) {
  const structure = normalizeStructure(employee);
  const fixedEarnings = structure
    .filter((item) => {
      const definition = findDefinition(setup, item.component);
      return !definition || definition.type === "Earning";
    })
    .reduce((sum, item) => {
      const definition = findDefinition(setup, item.component);
      return sum + (definition?.calculationType === "Percentage" ? 0 : item.amount);
    }, 0);
  const baseSalary = nonNegative(employee.basicSalary) || fixedEarnings;

  const earnings = [];
  const deductions = [];
  structure.forEach((item) => {
    const definition = findDefinition(setup, item.component);
    const type = definition?.type || "Earning";
    const calculationType = definition?.calculationType || "Fixed";
    const rawAmount = calculationType === "Percentage" ? baseSalary * item.amount / 100 : item.amount;
    const amount = roundMoney(rawAmount * factor);
    if (amount <= 0) return;
    const line = { component: item.component, amount, calculationType };
    if (type === "Deduction") deductions.push(line);
    else earnings.push(line);
  });

  return {
    earnings,
    deductions,
    earningsTotal: roundMoney(earnings.reduce((sum, item) => sum + item.amount, 0)),
    deductionsTotal: roundMoney(deductions.reduce((sum, item) => sum + item.amount, 0)),
  };
}

function calculateProgressiveTax(monthlyGross, slabs = []) {
  const annualTaxable = Math.max(0, number(monthlyGross) * 12);
  const normalized = (slabs || [])
    .map((slab) => ({
      fromAmount: nonNegative(slab.fromAmount),
      toAmount: slab.toAmount === null || slab.toAmount === undefined || slab.toAmount === ""
        ? Number.POSITIVE_INFINITY
        : nonNegative(slab.toAmount),
      rate: nonNegative(slab.rate),
    }))
    .filter((slab) => slab.toAmount > slab.fromAmount && slab.rate > 0)
    .sort((a, b) => a.fromAmount - b.fromAmount);

  const details = [];
  let annualTax = 0;
  normalized.forEach((slab) => {
    const taxableInSlab = Math.max(0, Math.min(annualTaxable, slab.toAmount) - Math.max(0, slab.fromAmount));
    const tax = taxableInSlab * slab.rate / 100;
    if (taxableInSlab > 0) details.push({ ...slab, taxableAmount: roundMoney(taxableInSlab), tax: roundMoney(tax) });
    annualTax += tax;
  });

  return {
    monthlyTax: roundMoney(annualTax / 12),
    annualTax: roundMoney(annualTax),
    annualTaxable: roundMoney(annualTaxable),
    details,
  };
}

function allocateLoans(loans = [], available = 0) {
  let remaining = nonNegative(available);
  const allocations = [];
  (loans || [])
    .filter((loan) => String(loan.status || "").toLowerCase() === "active" && nonNegative(loan.remainingBalance) > 0 && nonNegative(loan.installmentAmount) > 0)
    .forEach((loan) => {
      if (remaining <= 0) return;
      const amount = roundMoney(Math.min(remaining, nonNegative(loan.remainingBalance), nonNegative(loan.installmentAmount)));
      if (amount <= 0) return;
      allocations.push({ loan: loan._id, amount });
      remaining = roundMoney(remaining - amount);
    });
  return { allocations, total: roundMoney(allocations.reduce((sum, item) => sum + item.amount, 0)) };
}

function calculatePayrollEntry({ employee, setup = {}, attendance = [], loans = [], year, month }) {
  const proration = attendanceProration(attendance, year, month, employee.joiningDate);
  const components = calculateComponents(employee, setup, proration.factor);
  const statutory = setup.statutoryConfig || {};
  const eobiPercent = nonNegative(statutory.eobiPercent ?? statutory.eobiPercentage ?? statutory.eobi);
  const providentFundPercent = nonNegative(statutory.providentFundPercent ?? statutory.providentFundPercentage ?? statutory.providentFund);
  const eobi = roundMoney(components.earningsTotal * eobiPercent / 100);
  const providentFund = roundMoney(components.earningsTotal * providentFundPercent / 100);
  const loan = allocateLoans(loans, components.earningsTotal);
  const tax = calculateProgressiveTax(components.earningsTotal, setup.taxSlabs);
  const totalDeductions = roundMoney(components.deductionsTotal + eobi + providentFund + loan.total + tax.monthlyTax);
  const netPay = roundMoney(Math.max(0, components.earningsTotal - totalDeductions));

  return {
    employee: employee._id,
    employeeId: employee.employeeId,
    employeeName: employee.name,
    earnings: components.earningsTotal,
    earningsBreakdown: components.earnings,
    deductions: roundMoney(components.deductionsTotal + eobi + providentFund),
    deductionsBreakdown: {
      salaryComponents: components.deductions,
      eobi,
      providentFund,
    },
    loanDeduction: loan.total,
    loanAllocations: loan.allocations,
    tax: tax.monthlyTax,
    taxDetails: tax,
    netPay,
    attendance: proration,
    statutory: { eobi, providentFund },
  };
}

module.exports = {
  roundMoney,
  daysInMonth,
  workingDaysInMonth,
  attendanceProration,
  normalizeStructure,
  calculateComponents,
  calculateProgressiveTax,
  allocateLoans,
  calculatePayrollEntry,
};
