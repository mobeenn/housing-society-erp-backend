const { db } = require("../../config/db");

class Booking {
  static collectionName = "bookings";

  static STATUS = {
    PENDING_APPROVAL: "Pending Approval",
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled",
  };

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async create(data, createdBy) {
    return db.collection(this.collectionName).insertOne({
      member: data.member,
      plot: data.plot,
      bookingDate: data.bookingDate,
      price: data.price,
      discount: data.discount,
      developmentCharges: data.developmentCharges,
      additionalCharges: data.additionalCharges,
      bookingAmount: data.bookingAmount,
      status: Booking.STATUS.PENDING_APPROVAL,
      approvedBy: null,
      cancellationReason: null,
      refundAmount: 0,
      planTemplate: data.planTemplate,
      createdBy,
    });
  }

  static async update(id, data) {
    return db.collection(this.collectionName).updateOne({ _id: id }, data);
  }
}

class InstallmentPlan {
  static collectionName = "installmentPlans";

  static async findByBooking(booking) {
    return db.collection(this.collectionName).findOne({ booking });
  }

  static async create(data) {
    return db.collection(this.collectionName).insertOne({
      booking: data.booking,
      totalAmount: data.totalAmount,
      numberOfInstallments: data.numberOfInstallments,
      frequency: data.frequency,
      generatedInstallments: data.generatedInstallments || [],
    });
  }

  static async update(id, data) {
    return db.collection(this.collectionName).updateOne({ _id: id }, data);
  }
}

class Installment {
  static collectionName = "installments";

  static async createMany(data) {
    return db.collection(this.collectionName).insertMany(data);
  }

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async update(id, data) {
    return db.collection(this.collectionName).updateOne({ _id: id }, data);
  }
}

module.exports = { Booking, InstallmentPlan, Installment };