const FREQUENCIES = { MONTHLY: "monthly", QUARTERLY: "quarterly" };

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const addPeriods = (date, frequency, periods) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + (frequency === FREQUENCIES.QUARTERLY ? periods * 3 : periods));
  return next.toISOString();
};

const calculateNetPayable = ({ price, discount = 0, developmentCharges = 0, additionalCharges = 0 }) =>
  roundCurrency(Number(price) - Number(discount) + Number(developmentCharges) + Number(additionalCharges));

const calculateInstallmentSchedule = ({ totalAmount, bookingAmount = 0, numberOfInstallments, frequency, firstDueDate }) => {
  const count = Number(numberOfInstallments);
  if (!Number.isInteger(count) || count < 1) throw new Error("Number of installments must be a positive integer");
  if (!Object.values(FREQUENCIES).includes(frequency)) throw new Error("Frequency must be monthly or quarterly");

  const remainingAmount = roundCurrency(Number(totalAmount) - Number(bookingAmount));
  if (remainingAmount < 0) throw new Error("Booking amount cannot exceed the net payable amount");
  const baseAmount = roundCurrency(remainingAmount / count);
  const installments = Array.from({ length: count }, (_, index) => ({
    dueDate: addPeriods(firstDueDate, frequency, index),
    amount: index === count - 1 ? roundCurrency(remainingAmount - baseAmount * (count - 1)) : baseAmount,
  }));
  return { totalAmount: remainingAmount, installments };
};

module.exports = { FREQUENCIES, roundCurrency, calculateNetPayable, calculateInstallmentSchedule };