/**
 * P1-7: Cancelling a confirmed booking voids unpaid installments.
 */
const { test, before } = require("node:test");
const assert = require("node:assert");

const BookingService = require("../src/modules/bookings/service");
const { Booking, InstallmentPlan, Installment } = require("../src/modules/bookings/booking.model");
const { Plot } = require("../src/modules/properties/plot.model");
const { connectDB, db } = require("../src/config/db");

const fakeReq = { user: { _id: "test-user-booking-cancel" }, ip: "127.0.0.1", headers: {} };

before(async () => {
  await connectDB();
});

test("after ending a confirmed booking, no unpaid installment remains active", async () => {
  const plots = await Plot.find({ status: Plot.STATUS.ALLOTTED }, { limit: 1 });
  const plot = plots[0] || (await Plot.find({}, { limit: 1 }))[0];
  assert.ok(plot, "seeded plot required");

  await Plot.update(plot._id, { status: Plot.STATUS.ALLOTTED });

  const suffix = Date.now();
  const memberId = plot.currentOwner || `m-cancel-${suffix}`;

  const booking = await Booking.create(
    {
      member: memberId,
      plot: plot._id,
      bookingDate: new Date().toISOString(),
      price: 100000,
      discount: 0,
      developmentCharges: 0,
      additionalCharges: 0,
      bookingAmount: 10000,
      planTemplate: { numberOfInstallments: 2, frequency: "monthly" },
    },
    fakeReq.user._id
  );
  await Booking.update(booking._id, { status: Booking.STATUS.CONFIRMED });

  const plan = await InstallmentPlan.create({
    booking: booking._id,
    totalAmount: 90000,
    numberOfInstallments: 2,
    frequency: "monthly",
  });

  await Installment.createMany([
    {
      plan: plan._id,
      member: memberId,
      plot: plot._id,
      dueDate: new Date().toISOString(),
      amount: 45000,
      penaltyAmount: 0,
      discountAmount: 0,
      paidAmount: 45000,
      balance: 0,
      status: "Paid",
      overdueDays: 0,
    },
    {
      plan: plan._id,
      member: memberId,
      plot: plot._id,
      dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      amount: 45000,
      penaltyAmount: 0,
      discountAmount: 0,
      paidAmount: 0,
      balance: 45000,
      status: "Upcoming",
      overdueDays: 0,
    },
  ]);

  const cancelled = await BookingService.cancel(
    booking._id,
    { reason: "Customer withdrew", refundAmount: 45000 },
    fakeReq
  );

  assert.equal(cancelled.status, Booking.STATUS.CANCELLED);

  const after = await Installment.find({ plan: plan._id });
  const unpaidActive = after.filter(
    (row) => Number(row.balance || 0) > 0 && String(row.status) !== "Voided"
  );
  assert.equal(unpaidActive.length, 0);

  const unpaid = after.find((row) => Number(row.paidAmount || 0) === 0);
  assert.ok(unpaid);
  assert.equal(String(unpaid.status), "Voided");
  assert.equal(Number(unpaid.balance), 0);

  await db.collection(Installment.collectionName).deleteMany({ plan: plan._id });
  await db.collection(InstallmentPlan.collectionName).deleteOne({ _id: plan._id });
  await db.collection(Booking.collectionName).deleteOne({ _id: booking._id });
});
