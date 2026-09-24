const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const calculateOverdueDays = (dueDate, now = new Date()) => { const due = new Date(dueDate); return due < now ? Math.max(0, Math.floor((now - due) / 86400000)) : 0; };

const calculatePenalty = ({ balance, overdueDays, rule = {}, discountAmount = 0 }) => {
  const billableDays = Math.max(0, Number(overdueDays) - Number(rule.graceDays || 0));
  const chargeableBalance = Math.max(0, Number(balance) - Number(discountAmount || 0));
  if (!billableDays || !chargeableBalance || !rule.amount) return 0;
  const periods = rule.period === "month" ? Math.ceil(billableDays / 30) : billableDays;
  return roundCurrency(rule.type === "percentage" ? chargeableBalance * (Number(rule.amount) / 100) * periods : Number(rule.amount) * periods);
};

const installmentStatus = ({ balance, paidAmount, dueDate, now = new Date() }) => {
  if (balance <= 0) return "Paid";
  if (paidAmount > 0) return "PartiallyPaid";
  const overdueDays = calculateOverdueDays(dueDate, now);
  return overdueDays > 0 ? "Overdue" : new Date(dueDate) <= now ? "Due" : "Upcoming";
};

const allocatePayment = ({ installments, paymentAmount, penaltyRule, now = new Date() }) => {
  let remaining = roundCurrency(paymentAmount); if (remaining <= 0) throw new Error("Payment amount must be greater than zero");
  const allocations = []; const updates = [];
  for (const installment of [...installments].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))) {
    const principalBalance = Math.max(0, Number(installment.amount) - Number(installment.paidAmount || 0) - Number(installment.discountAmount || 0));
    if (!principalBalance && !Number(installment.penaltyAmount || 0)) continue;
    const overdueDays = calculateOverdueDays(installment.dueDate, now);
    const penaltyAmount = Math.max(Number(installment.penaltyAmount || 0), calculatePenalty({ balance: principalBalance, overdueDays, rule: penaltyRule, discountAmount: installment.discountAmount }));
    const outstanding = roundCurrency(principalBalance + penaltyAmount); if (!outstanding) continue;
    const amountApplied = Math.min(remaining, outstanding); const paidAmount = roundCurrency(Number(installment.paidAmount || 0) + amountApplied); const balance = roundCurrency(Math.max(0, outstanding - amountApplied));
    allocations.push({ installment: installment._id, amountApplied: roundCurrency(amountApplied) });
    updates.push({ id: installment._id, paidAmount, balance, penaltyAmount, overdueDays, status: installmentStatus({ balance, paidAmount, dueDate: installment.dueDate, now }) });
    remaining = roundCurrency(remaining - amountApplied); if (remaining <= 0) break;
  }
  if (remaining > 0) throw new Error(`Payment exceeds outstanding balance by ${remaining}`);
  return { allocations, updates, unappliedAmount: remaining };
};

module.exports = { roundCurrency, calculateOverdueDays, calculatePenalty, installmentStatus, allocatePayment };