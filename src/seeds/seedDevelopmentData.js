const crypto = require("crypto");
const { connectDB, db } = require("../config/db");
const env = require("../config/env");

const DATASET_VERSION = "2026.09.1";
const YEAR = 2026;
const REFERENCE_DATE = "2026-09-24T12:00:00.000Z";

const COLLECTIONS = {
  members: "members",
  plots: "plots",
  ownershipHistory: "ownershipHistory",
  bookings: "bookings",
  installmentPlans: "installmentPlans",
  installments: "installments",
  payments: "payments",
  complaints: "complaints",
  assets: "assets",
  workOrders: "workOrders",
  employees: "employees",
  attendance: "attendance",
  leaveRequests: "leaveRequests",
  guards: "guards",
  dutyRoster: "dutyRoster",
  vehicles: "vehicles",
  passes: "passes",
  visitorEntries: "visitorEntries",
  blacklist: "blacklist",
  vendors: "vendors",
  purchaseRequests: "purchaseRequests",
  quotations: "quotations",
  purchaseOrders: "purchaseOrders",
  grns: "goodsReceivedNotes",
  expenses: "expenses",
  transferRequests: "transferRequests",
  nocApplications: "nocApplications",
  possessionApplications: "possessionApplications",
  constructionApplications: "constructionApplications",
  siteInspections: "siteInspections",
};

const MEMBER_NAMES = [
  "Ayesha Khan",
  "Muhammad Bilal",
  "Fatima Zahra",
  "Usman Sheikh",
  "Hina Aslam",
  "Ahmed Raza",
  "Hina Noor",
  "Bilal Ahmed",
  "Sana Malik",
  "Omar Saeed",
  "Mariam Yousaf",
  "Ali Hamza",
  "Zainab Tariq",
  "Usman Ghani",
  "Ayesha Siddiqui",
  "Hassan Mehmood",
  "Farah Iqbal",
  "Kamran Shah",
  "Rabia Anwar",
  "Imran Qureshi",
  "Noor Fatima",
  "Waqas Ali",
  "Sadia Hussain",
  "Adnan Mirza",
  "Kiran Javed",
  "Naveed Akhtar",
  "Saima Rehman",
  "Tariq Javed",
  "Mahira Solangi",
  "Danish Riaz",
];

const FATHER_NAMES = [
  "Khan",
  "Bilal",
  "Zahra",
  "Sheikh",
  "Aslam",
  "Raza",
  "Noor",
  "Ahmed",
  "Malik",
  "Saeed",
  "Yousaf",
  "Hamza",
  "Tariq",
  "Ghani",
  "Siddiqui",
  "Mehmood",
  "Iqbal",
  "Shah",
  "Anwar",
  "Qureshi",
  "Yusuf",
  "Ali",
  "Hussain",
  "Mirza",
  "Javed",
  "Akhtar",
  "Rehman",
  "Javed",
  "Solangi",
  "Riaz",
];

const id = (...parts) =>
  crypto
    .createHash("sha256")
    .update(`housing-society-demo:${parts.join(":")}`)
    .digest("hex")
    .slice(0, 24);

const fullHash = (...parts) =>
  crypto
    .createHash("sha256")
    .update(`housing-society-demo:${parts.join(":")}`)
    .digest("hex");

const at = (month, day, hour = 9, minute = 0) =>
  new Date(Date.UTC(YEAR, month, day, hour, minute)).toISOString();

const dateOnly = (month, day) => at(month, day).slice(0, 10);

const calendarDate = (year, month, day) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const addDays = (isoDate, days) =>
  new Date(new Date(isoDate).getTime() + days * 86400000).toISOString();

const addHours = (isoDate, hours) =>
  new Date(new Date(isoDate).getTime() + hours * 3600000).toISOString();

const roundMoney = (value) => Math.round(value / 1000) * 1000;

const businessNumber = (prefix, sequence, year = YEAR, padLength = 6) =>
  `${prefix}-${year}-${String(sequence).padStart(padLength, "0")}`;

const withRecordTimes = (data, createdAt, updatedAt = createdAt) => ({
  ...data,
  createdAt,
  updatedAt,
});

const clone = (value) => JSON.parse(JSON.stringify(value));

async function findRequired(collectionName, query, label) {
  const record = await db.collection(collectionName).findOne(query);
  if (!record) {
    throw new Error(
      `Missing required ${label}. Run npm run seed before seeding development data.`,
    );
  }
  return record;
}

async function loadReferences() {
  const superAdmin = await findRequired(
    "users",
    {
      email: (
        env.SUPERADMIN_EMAIL || "admin@housing-society.local"
      ).toLowerCase(),
    },
    "Super Admin user",
  );

  const [blocks, streets, plotCategories, propertyTypes, departments] =
    await Promise.all([
      db.collection("blocks").find({}),
      db.collection("streets").find({}),
      db.collection("plotCategories").find({}),
      db.collection("propertyTypes").find({}),
      db.collection("departments").find({}),
    ]);

  const required = [
    [blocks, "blocks"],
    [streets, "streets"],
    [plotCategories, "plot categories"],
    [propertyTypes, "property types"],
    [departments, "departments"],
  ];

  for (const [records, label] of required) {
    if (!records.length) {
      throw new Error(
        `Missing ${label}. Run npm run seed before seeding development data.`,
      );
    }
  }

  return {
    superAdmin,
    blocks,
    streets,
    plotCategories,
    propertyTypes,
    departments,
  };
}

function buildMembers(superAdminId) {
  return MEMBER_NAMES.map((name, index) => {
    const sequence = index + 1;
    const memberId = id("member", sequence);
    const status =
      sequence === 29 ? "Inactive" : sequence === 30 ? "Blacklisted" : "Active";

    return withRecordTimes(
      {
        _id: memberId,
        memberId: businessNumber("MEM", 1000 + sequence),
        membershipNumber: businessNumber("MEM", 1000 + sequence),
        name,
        cnic: `42101-${String(1000000 + sequence).padStart(7, "0")}-${(sequence % 9) + 1}`,
        phone: `+92 3${String(10 + (sequence % 40)).padStart(2, "0")}-${String(1000000 + sequence * 37).slice(0, 7)}`,
        email: `member${String(sequence).padStart(3, "0")}@demo.housing.local`,
        address: `House ${20 + sequence}, Street ${(sequence % 4) + 1}, Block ${String.fromCharCode(65 + (sequence % 3))}, Demo Housing Society, Lahore`,
        nominee:
          sequence % 2 === 0
            ? {
                name: `${FATHER_NAMES[index]} ${name.split(" ")[0]}`,
                relation: sequence % 4 === 0 ? "Spouse" : "Family",
                cnic: `42200-${String(2000000 + sequence).padStart(7, "0")}-${(sequence % 9) + 1}`,
              }
            : null,
        status,
        photo: null,
        documents: [],
        createdBy: superAdminId,
      },
      at(2023 + (sequence % 2), (sequence % 11) + 1, 10, sequence % 60),
      at(2026, 8, 10, sequence % 60),
    );
  });
}

function getPlotStatus(index) {
  if ([1, 8, 9, 10].includes(index)) return "Allotted";
  if (index === 2) return "Constructed";
  if (index === 3) return "Transferred";
  if ([4, 30].includes(index)) return "Booked";
  if (index === 5) return "Possessed";
  if (index === 6) return "Under Construction";
  if ([31, 32, 33].includes(index)) return "Reserved";
  if (index >= 34) return "Available";
  if (index % 5 === 0) return "Possessed";
  if (index % 4 === 0) return "Constructed";
  if (index % 3 === 0) return "Sold";
  return "Sold";
}

function buildPlots(members, references) {
  const blockIds = references.blocks.map((record) => record._id);
  const streetIds = references.streets.map((record) => record._id);
  const residentialId = references.plotCategories.find(
    (record) => record.code === "RES",
  )?._id;
  const commercialId = references.plotCategories.find(
    (record) => record.code === "COM",
  )?._id;
  const mixedId = references.plotCategories.find(
    (record) => record.code === "MIX",
  )?._id;
  const houseId = references.propertyTypes.find(
    (record) => record.code === "HSE",
  )?._id;
  const apartmentId = references.propertyTypes.find(
    (record) => record.code === "APT",
  )?._id;
  const shopId = references.propertyTypes.find(
    (record) => record.code === "SHP",
  )?._id;

  return Array.from({ length: 40 }, (_, offset) => {
    const index = offset + 1;
    const status = getPlotStatus(index);
    const hasOwner = index <= 29 && status !== "Booked";
    const currentOwner = hasOwner ? members[index - 1]._id : null;
    const ownerSince =
      index === 3
        ? "2026-03-01T00:00:00.000Z"
        : hasOwner
          ? at(2024 + (index % 2), (index % 11) + 1)
          : null;
    const category =
      index % 11 === 0
        ? commercialId
        : index % 7 === 0
          ? mixedId
          : residentialId;
    const propertyType =
      category === commercialId
        ? shopId
        : index % 3 === 0
          ? apartmentId
          : houseId;
    const size =
      index % 10 === 0 ? "1 Kanal" : index % 4 === 0 ? "10 Marla" : "5 Marla";
    const price = roundMoney((3.5 + (index % 8) * 0.65) * 1000000);

    return withRecordTimes(
      {
        _id: id("plot", index),
        plotNumber: `PLT-${String(1000 + index).padStart(5, "0")}`,
        block: blockIds[(index - 1) % blockIds.length],
        street: streetIds[(index - 1) % streetIds.length],
        size,
        category,
        propertyType,
        fileNumber: `DEMO-FILE-${String(index).padStart(3, "0")}`,
        location: `Block ${String.fromCharCode(65 + ((index - 1) % 3))}, Street ${((index - 1) % 4) + 1}`,
        currentOwner,
        ownerSince,
        status,
        isBlocked: false,
        price,
        createdBy: references.superAdmin._id,
      },
      at(2023, (index % 11) + 1, 11, index % 60),
      at(2026, 8, 11, index % 60),
    );
  });
}

function buildOwnershipHistory(plots, members) {
  const records = [];

  plots.forEach((plot, offset) => {
    if (!plot.currentOwner) return;
    const index = offset + 1;

    if (index === 3) {
      records.push(
        withRecordTimes(
          {
            _id: id("ownership", index, "original"),
            plot: plot._id,
            member: members[1]._id,
            fromDate: "2024-03-01T00:00:00.000Z",
            toDate: "2026-02-28T00:00:00.000Z",
            type: "Allotment",
            remarks: "Original allotment completed through property transfer.",
          },
          "2024-03-01T00:00:00.000Z",
          "2026-03-01T00:00:00.000Z",
        ),
        withRecordTimes(
          {
            _id: id("ownership", index, "current"),
            plot: plot._id,
            member: plot.currentOwner,
            fromDate: "2026-03-01T00:00:00.000Z",
            toDate: null,
            type: "Transfer",
            remarks: "Ownership transferred to the current member.",
          },
          "2026-03-01T00:00:00.000Z",
        ),
      );
      return;
    }

    records.push(
      withRecordTimes(
        {
          _id: id("ownership", index, "current"),
          plot: plot._id,
          member: plot.currentOwner,
          fromDate: plot.ownerSince,
          toDate: null,
          type: "Allotment",
          remarks: "Current ownership record.",
        },
        plot.ownerSince,
      ),
    );
  });

  return records;
}

function buildFinancialData(members, plots) {
  const bookingSpecs = [
    {
      plot: 1,
      firstMonth: 5,
      day: 10,
      states: ["Paid", "Paid", "Paid", "Paid"],
    },
    {
      plot: 5,
      firstMonth: 6,
      day: 15,
      states: ["Paid", "Paid", "Paid", "Upcoming"],
    },
    {
      plot: 6,
      firstMonth: 7,
      day: 12,
      states: ["Paid", "Paid", "PartiallyPaid", "Upcoming"],
    },
    {
      plot: 7,
      firstMonth: 6,
      day: 8,
      states: ["Paid", "Paid", "PartiallyPaid", "Upcoming"],
    },
    {
      plot: 8,
      firstMonth: 5,
      day: 5,
      states: ["Paid", "PartiallyPaid", "Overdue", "Due"],
    },
    {
      plot: 9,
      firstMonth: 7,
      day: 18,
      states: ["Paid", "Due", "Upcoming", "Upcoming"],
    },
    {
      plot: 10,
      firstMonth: 6,
      day: 20,
      states: ["Overdue", "Overdue", "Due", "Upcoming"],
    },
    {
      plot: 12,
      firstMonth: 7,
      day: 22,
      states: ["Paid", "Paid", "Upcoming", "Upcoming"],
    },
  ];

  const bookings = [];
  const plans = [];
  const installments = [];
  const payments = [];
  const methods = ["BankTransfer", "Online", "Cash", "Cheque"];
  let receiptSequence = 1001;

  bookingSpecs.forEach((spec, bookingIndex) => {
    const plot = plots[spec.plot - 1];
    const member = members[spec.plot - 1];
    const bookingId = id("booking", spec.plot);
    const planId = id("installment-plan", spec.plot);
    const discount = roundMoney(plot.price * 0.02);
    const developmentCharges = 150000;
    const additionalCharges = 50000;
    const netPayable =
      plot.price - discount + developmentCharges + additionalCharges;
    const installmentAmount = roundMoney(netPayable / 4);
    const generatedIds = Array.from({ length: 4 }, (_, index) =>
      id("installment", spec.plot, index + 1),
    );
    const firstDueDate = dateOnly(spec.firstMonth, spec.day);

    bookings.push(
      withRecordTimes(
        {
          _id: bookingId,
          member: member._id,
          plot: plot._id,
          bookingDate: at(
            Math.max(0, spec.firstMonth - 1),
            Math.max(1, spec.day - 5),
            10,
            bookingIndex * 5,
          ),
          price: plot.price,
          discount,
          developmentCharges,
          additionalCharges,
          bookingAmount: 0,
          status: "Confirmed",
          approvedBy: null,
          cancellationReason: null,
          refundAmount: 0,
          planTemplate: {
            numberOfInstallments: 4,
            frequency: "monthly",
            firstDueDate,
          },
          createdBy: null,
          approvedAt: at(
            Math.max(0, spec.firstMonth - 1),
            Math.max(2, spec.day - 3),
            12,
            bookingIndex * 5,
          ),
        },
        at(
          Math.max(0, spec.firstMonth - 1),
          Math.max(1, spec.day - 5),
          10,
          bookingIndex * 5,
        ),
        at(
          Math.max(0, spec.firstMonth - 1),
          Math.max(2, spec.day - 3),
          12,
          bookingIndex * 5,
        ),
      ),
    );

    plans.push(
      withRecordTimes(
        {
          _id: planId,
          booking: bookingId,
          totalAmount: netPayable,
          numberOfInstallments: 4,
          frequency: "monthly",
          generatedInstallments: generatedIds,
        },
        at(spec.firstMonth, Math.min(24, spec.day), 9, bookingIndex * 5),
      ),
    );

    spec.states.forEach((state, installmentIndex) => {
      const dueMonth = spec.firstMonth + installmentIndex;
      const dueDay = Math.min(25, spec.day + installmentIndex);
      const dueDate = dateOnly(dueMonth, dueDay);
      const amount =
        installmentIndex === 3
          ? netPayable - installmentAmount * 3
          : installmentAmount;
      const paidAmount =
        state === "Paid"
          ? amount
          : state === "PartiallyPaid"
            ? roundMoney(amount * 0.4)
            : 0;
      const installmentId = generatedIds[installmentIndex];
      const createdAt = at(
        dueMonth,
        dueDay,
        8,
        bookingIndex * 5 + installmentIndex,
      );

      installments.push(
        withRecordTimes(
          {
            _id: installmentId,
            plan: planId,
            member: member._id,
            plot: plot._id,
            dueDate,
            amount,
            penaltyAmount: 0,
            discountAmount: 0,
            paidAmount,
            balance: amount - paidAmount,
            status: state,
            overdueDays: state === "Overdue" ? 14 + installmentIndex : 0,
          },
          createdAt,
          paidAmount ? addDays(createdAt, 1) : createdAt,
        ),
      );

      if (paidAmount > 0) {
        const collectedAt = addDays(createdAt, 1);
        payments.push(
          withRecordTimes(
            {
              _id: id("payment", spec.plot, installmentIndex + 1),
              receiptNumber: businessNumber("RCP", receiptSequence++, YEAR, 7),
              member: member._id,
              plot: plot._id,
              amount: paidAmount,
              method:
                methods[(bookingIndex + installmentIndex) % methods.length],
              allocations: [
                { installment: installmentId, amountApplied: paidAmount },
              ],
              collectedBy: null,
              remarks:
                state === "PartiallyPaid"
                  ? "Partial installment payment"
                  : "Installment payment received",
              status: "Completed",
            },
            collectedAt,
          ),
        );
      }
    });
  });

  const pendingPlot = plots[29];
  const pendingMember = members[29];
  bookings.push(
    withRecordTimes(
      {
        _id: id("booking", 30),
        member: pendingMember._id,
        plot: pendingPlot._id,
        bookingDate: at(8, 18, 14),
        price: pendingPlot.price,
        discount: 0,
        developmentCharges: 100000,
        additionalCharges: 25000,
        bookingAmount: 0,
        status: "Pending Approval",
        approvedBy: null,
        cancellationReason: null,
        refundAmount: 0,
        planTemplate: {
          numberOfInstallments: 4,
          frequency: "monthly",
          firstDueDate: "2026-11-15",
        },
        createdBy: null,
      },
      at(8, 18, 14),
    ),
  );

  return { bookings, plans, installments, payments };
}

function buildOperationalData(members, plots, references) {
  const categories = [
    "Sanitation",
    "Electricity",
    "Water & Sewerage",
    "Roads & Infrastructure",
    "Security",
    "Noise",
    "Sanitation",
    "Electricity",
    "Water & Sewerage",
    "Roads & Infrastructure",
    "Security",
    "Other",
    "Sanitation",
    "Electricity",
    "Noise",
  ];
  const priorities = ["Medium", "High", "Low", "Urgent", "Medium"];
  const statuses = [
    "New",
    "Assigned",
    "InProgress",
    "Resolved",
    "Closed",
    "New",
    "Assigned",
    "InProgress",
    "Resolved",
    "Closed",
    "Reopened",
    "New",
    "Assigned",
    "InProgress",
    "Resolved",
  ];
  const descriptions = [
    "Streetlight near the main gate has been flickering for three nights.",
    "Waste collection vehicle missed Block B on its scheduled day.",
    "Water pressure is low in the west-side offices during peak hours.",
    "Pothole is developing near the commercial entrance.",
    "Unauthorized vehicle was reported inside the basement parking area.",
    "Loud music was reported after the permitted community hours.",
    "Garden waste is blocking the pedestrian path beside the park.",
    "Transformer noise increased after the latest maintenance activity.",
    "Drainage overflow was observed following heavy rain.",
    "Cracked paving slabs require immediate safety attention.",
    "Visitor was denied entry without a valid pass.",
    "Overflowing dustbin near the community hall needs service.",
    "Streetlight is completely out in the parking area.",
    "Water seepage is visible along the internal boundary wall.",
    "Late-night construction noise disturbed residents.",
  ];
  const departmentByCategory = {
    Sanitation: "Operations",
    Electricity: "Operations",
    "Water & Sewerage": "Operations",
    "Roads & Infrastructure": "Operations",
    Security: "Security",
    Noise: "Security",
    Other: "Operations",
  };

  const complaints = categories.map((category, offset) => {
    const index = offset + 1;
    const plot = plots[(index * 2 - 1) % 29];
    const member = members[(index * 2 - 1) % 29];
    const priority = priorities[offset % priorities.length];
    const status = statuses[offset];
    const createdAt = at(
      4 + (offset % 5),
      3 + offset,
      8 + (offset % 8),
      offset * 2,
    );
    const slaHours = { Low: 72, Medium: 48, High: 24, Urgent: 8 }[priority];
    const department = references.departments.find(
      (record) => record.name === departmentByCategory[category],
    );
    const resolved = status === "Resolved" || status === "Closed";

    return withRecordTimes(
      {
        _id: id("complaint", index),
        complaintNumber: businessNumber("CMP", 1000 + index),
        member: member._id,
        plot: plot._id,
        category,
        description: descriptions[offset],
        location: plot.location,
        priority,
        attachments: [],
        assignedDepartment: department?._id || references.departments[0]._id,
        assignedStaff: status === "New" ? null : references.superAdmin._id,
        slaDueDate: addHours(createdAt, slaHours),
        status,
        comments: [
          {
            author: references.superAdmin._id,
            text: "Complaint reviewed and added to the operations queue.",
            createdAt: addHours(createdAt, 2),
          },
        ],
        resolutionNote: resolved
          ? "Field work completed and reported back to the member."
          : null,
        resolvedAt: resolved ? addDays(createdAt, 2) : null,
        createdBy: references.superAdmin._id,
      },
      createdAt,
      resolved ? addDays(createdAt, 2) : addHours(createdAt, 2),
    );
  });

  const assetDefinitions = [
    ["Main Boulevard Streetlights", "light", "Main Boulevard entrance"],
    ["Community Park Lighting", "light", "Central community park"],
    ["Block B Waste Collection Point", "other", "Block B service area"],
    ["North Drainage Line", "drainage", "North boundary"],
    ["Water Pump Station", "water", "Operations compound"],
    ["Clubhouse Generator", "building", "Community clubhouse"],
    ["Main Gate Barrier", "building", "Main gate"],
    ["Children Park Equipment", "park", "Children's park"],
    ["Commercial Road Surface", "road", "Commercial entrance"],
    ["Boundary Sewer Line", "sewerage", "Block C boundary"],
  ];

  const assets = assetDefinitions.map((definition, offset) => {
    const index = offset + 1;
    return withRecordTimes(
      {
        _id: id("asset", index),
        name: definition[0],
        type: definition[1],
        location: definition[2],
        block: references.blocks[offset % references.blocks.length]._id,
        createdBy: references.superAdmin._id,
      },
      at(3 + (offset % 3), 2 + offset, 9, offset),
      at(8, 20, 9, offset),
    );
  });

  const workOrders = complaints
    .filter((complaint) => complaint.status !== "New")
    .map((complaint, offset) => {
      const index = offset + 1;
      const createdAt = addHours(complaint.createdAt, 4);
      const status =
        complaint.status === "Resolved" || complaint.status === "Closed"
          ? "Completed"
          : complaint.status === "InProgress" || complaint.status === "Reopened"
            ? "InProgress"
            : "Open";
      const completed = status === "Completed";
      const laborCost = 5000 + index * 750;
      const materialCost = 3000 + index * 500;

      return withRecordTimes(
        {
          _id: id("work-order", index),
          asset: assets[(index - 1) % assets.length]._id,
          relatedComplaint: complaint._id,
          description: `Resolve complaint: ${complaint.description}`,
          assignedStaff: references.superAdmin._id,
          contractor: null,
          priority: complaint.priority,
          expectedCompletion: addDays(createdAt, 5),
          materials: [
            {
              item: index % 2 ? "Electrical fittings" : "Maintenance supplies",
              quantity: 2 + index,
            },
          ],
          laborCost,
          materialCost,
          status,
          progressLog: [
            {
              note:
                status === "Open"
                  ? "Work order assigned and scheduled."
                  : "Technician started work on site.",
              author: references.superAdmin._id,
              date: addHours(createdAt, 2),
            },
          ],
          completionNote: completed
            ? "All corrective work completed and verified."
            : null,
          completedAt: completed ? addDays(createdAt, 2) : null,
          createdBy: references.superAdmin._id,
        },
        createdAt,
        completed ? addDays(createdAt, 2) : addHours(createdAt, 2),
      );
    });

  return { complaints, assets, workOrders };
}

function buildHrData(members, references) {
  const employees = members.slice(0, 10).map((member, offset) => {
    const index = offset + 1;
    const department = [
      "Operations",
      "Finance",
      "Administration",
      "HR",
      "Security",
    ][offset % 5];
    const designation = [
      "Maintenance Supervisor",
      "Accounts Officer",
      "Admin Coordinator",
      "HR Assistant",
      "Security Supervisor",
      "Electrician",
      "Accountant",
      "Office Assistant",
      "HR Officer",
      "Security Guard",
    ][offset];

    return withRecordTimes(
      {
        _id: id("employee", index),
        employeeId: `EMP-DEMO-${String(index).padStart(4, "0")}`,
        name: member.name,
        cnic: `35201-${String(3000000 + index).padStart(7, "0")}-${(index % 9) + 1}`,
        phone: member.phone,
        email: `employee${String(index).padStart(2, "0")}@demo.housing.local`,
        department,
        designation,
        joiningDate: dateOnly(2 + (index % 3), 1 + index),
        dateOfBirth: calendarDate(
          1984 + index,
          1 + (index % 11),
          5 + (index % 20),
        ),
        address: member.address,
        emergencyContact: {
          name: FATHER_NAMES[offset],
          phone: `+92 3${String(50 + index).padStart(2, "0")}-${String(5000000 + index * 41).slice(0, 7)}`,
          relation: "Family",
        },
        linkedUser: null,
        documents: [],
        basicSalary: 45000 + index * 3500,
        allowances: 5000 + index * 250,
        deductions: index % 3,
        bankAccount: `DEMO-BANK-${String(index).padStart(4, "0")}`,
        status: index === 5 ? "On Leave" : "Active",
        remarks: null,
        createdBy: references.superAdmin._id,
      },
      at(2 + (index % 3), 1 + index, 9, index),
      at(8, 19, 9, index),
    );
  });

  const attendanceDates = ["2026-09-18", "2026-09-21", "2026-09-22"];
  const attendance = employees.flatMap((employee, employeeIndex) =>
    attendanceDates.map((date, dayIndex) => {
      const index = employeeIndex * attendanceDates.length + dayIndex + 1;
      const status =
        (employeeIndex + dayIndex) % 7 === 0
          ? "Absent"
          : employee.status === "On Leave" && dayIndex === 2
            ? "Leave"
            : "Present";
      return withRecordTimes(
        {
          _id: id("attendance", employee._id, date),
          employee: employee._id,
          date,
          status,
          checkIn:
            status === "Present"
              ? `${date}T08:${String(5 + employeeIndex).padStart(2, "0")}:00.000Z`
              : null,
          checkOut:
            status === "Present"
              ? `${date}T17:${String(employeeIndex % 6).padStart(2, "0")}:00.000Z`
              : null,
          remarks: status === "Absent" ? "No intimation received" : null,
          createdBy: references.superAdmin._id,
        },
        `${date}T18:00:00.000Z`,
      );
    }),
  );

  const leaveDefinitions = [
    {
      employee: 0,
      type: "Annual",
      from: "2026-08-03",
      to: "2026-08-07",
      status: "Approved",
      reason: "Family vacation",
    },
    {
      employee: 2,
      type: "Sick",
      from: "2026-09-10",
      to: "2026-09-11",
      status: "Approved",
      reason: "Medical leave",
    },
    {
      employee: 4,
      type: "Casual",
      from: "2026-09-28",
      to: "2026-09-29",
      status: "Pending",
      reason: "Personal appointment",
    },
    {
      employee: 6,
      type: "Unpaid",
      from: "2026-10-05",
      to: "2026-10-09",
      status: "Pending",
      reason: "Extended personal leave",
    },
    {
      employee: 8,
      type: "Annual",
      from: "2026-07-20",
      to: "2026-07-24",
      status: "Rejected",
      reason: "Critical month-end workload",
    },
  ];

  const leaveRequests = leaveDefinitions.map((definition, offset) => {
    const index = offset + 1;
    const days =
      Math.round(
        (new Date(definition.to) - new Date(definition.from)) / 86400000,
      ) + 1;
    const approved = definition.status === "Approved";
    const decided = definition.status !== "Pending";
    return withRecordTimes(
      {
        _id: id("leave", index),
        employee: employees[definition.employee]._id,
        type: definition.type,
        fromDate: definition.from,
        toDate: definition.to,
        reason: definition.reason,
        status: definition.status,
        balanceSnapshot: {
          total: 18,
          used: approved ? 4 + days : 0,
          available: approved ? 14 - days : 18,
        },
        approvedBy: decided ? references.superAdmin._id : null,
        approvedAt: decided
          ? addDays(`${definition.from}T09:00:00.000Z`, -1)
          : null,
        rejectionReason:
          definition.status === "Rejected" ? definition.reason : null,
        createdBy: references.superAdmin._id,
      },
      `${definition.from}T08:00:00.000Z`,
      decided
        ? addDays(`${definition.from}T09:00:00.000Z`, -1)
        : `${definition.from}T08:00:00.000Z`,
    );
  });

  return { employees, attendance, leaveRequests };
}

function buildSecurityData(members, references) {
  const guards = members.slice(20, 25).map((member, offset) => {
    const index = offset + 1;
    return withRecordTimes(
      {
        _id: id("guard", index),
        user: null,
        name: member.name,
        phone: member.phone,
        supervisor: null,
        shift: ["Morning", "Evening", "Night", "Morning", "Evening"][offset],
        status: "Active",
        createdBy: references.superAdmin._id,
      },
      at(4 + offset, 2 + index, 8, index),
      at(8, 21, 8, index),
    );
  });

  const rosterDates = ["2026-09-18", "2026-09-21", "2026-09-22"];
  const dutyRoster = guards.flatMap((guard, guardIndex) =>
    rosterDates.map((date, dayIndex) => {
      const index = guardIndex * rosterDates.length + dayIndex + 1;
      return withRecordTimes(
        {
          _id: id("roster", guard._id, date),
          guard: guard._id,
          date,
          shift: guard.shift,
          attendanceStatus:
            (guardIndex + dayIndex) % 8 === 0 ? "Leave" : "Present",
          createdBy: references.superAdmin._id,
        },
        `${date}T07:00:00.000Z`,
      );
    }),
  );

  const vehicleTypes = ["Car", "SUV", "Bike", "Car", "Van"];
  const models = [
    "Toyota Corolla",
    "Honda Civic",
    "Suzuki Cultus",
    "Toyota Yaris",
    "Hiace Van",
  ];
  const vehicles = Array.from({ length: 16 }, (_, offset) => {
    const index = offset + 1;
    const owner = members[(index - 1) % members.length];
    const issuedAt = at(3 + (index % 5), 1 + (index % 20), 10, index % 60);
    return withRecordTimes(
      {
        _id: id("vehicle", index),
        owner: owner._id,
        number: `LHR-DEMO-${String(1000 + index)}`,
        type: vehicleTypes[index % vehicleTypes.length],
        model: models[index % models.length],
        stickerNumber: `STK-${YEAR}-${String(1000 + index)}`,
        stickerIssuedAt: issuedAt,
        status: index === 14 ? "Blocked" : "Active",
        createdBy: references.superAdmin._id,
      },
      issuedAt,
      at(8, 21, 10, index % 60),
    );
  });

  const passes = Array.from({ length: 10 }, (_, offset) => {
    const index = offset + 1;
    const member = members[(index * 2) % members.length];
    const status =
      index === 8
        ? "Revoked"
        : index === 9
          ? "Expired"
          : index === 10
            ? "Active"
            : "Active";
    const type =
      index % 3 === 0
        ? "Contractor"
        : index % 3 === 1
          ? "Temporary"
          : "Visitor";
    return withRecordTimes(
      {
        _id: id("pass", index),
        passNumber: `PASS-DEMO-${String(1000 + index)}`,
        type,
        holderName:
          index % 3 === 0
            ? `${MEMBER_NAMES[(index * 2) % 30]} Services`
            : member.name,
        phone: `+92 3${String(70 + index).padStart(2, "0")}-${String(7000000 + index * 73).slice(0, 7)}`,
        cnic: `42300-${String(4000000 + index).padStart(7, "0")}-${(index % 9) + 1}`,
        validFrom: dateOnly(6 + (index % 3), 1 + index),
        validTo: dateOnly(index === 9 ? 7 : 11, 20 + index),
        relatedMember: member._id,
        status,
        purpose:
          type === "Contractor" ? "Scheduled maintenance work" : "Family visit",
        notes: null,
        createdBy: references.superAdmin._id,
      },
      at(6 + (index % 3), 1 + index, 11, index),
      at(8, 22, 11, index),
    );
  });

  const activePassIds = passes
    .filter((pass) => pass.status === "Active")
    .map((pass) => pass._id);
  const visitorEntries = Array.from({ length: 24 }, (_, offset) => {
    const index = offset + 1;
    const day = index <= 12 ? 24 : 23;
    const hour = 7 + (index % 10);
    const entryTime = at(8, day, hour, (index * 3) % 60);
    const active = index % 4 === 0;
    const host = members[(index * 3) % members.length];
    return withRecordTimes(
      {
        _id: id("visitor", index),
        visitorName: `${MEMBER_NAMES[(index * 5) % 30].split(" ")[0]} Visitor ${index}`,
        phone: `+92 3${String(80 + (index % 10)).padStart(2, "0")}-${String(8000000 + index * 91).slice(0, 7)}`,
        cnic: `42400-${String(5000000 + index).padStart(7, "0")}-${(index % 9) + 1}`,
        hostMember: host._id,
        purpose:
          index % 3 === 0
            ? "Delivery"
            : index % 3 === 1
              ? "Family visit"
              : "Contractor visit",
        gate: index % 2 ? "Main Gate" : "Service Gate",
        vehicleNumber:
          index % 3 === 0 ? `VIS-DEMO-${String(100 + index)}` : null,
        entryTime,
        exitTime: active ? null : addHours(entryTime, 1 + (index % 4)),
        exitMarkedBy: active ? null : references.superAdmin._id,
        remarks: null,
        passId: index <= 6 ? activePassIds[index - 1] || null : null,
        createdBy: references.superAdmin._id,
      },
      entryTime,
      active ? entryTime : addHours(entryTime, 1 + (index % 4)),
    );
  });

  const blacklist = [
    {
      _id: id("blacklist", 1),
      name: "Unknown Demo Person",
      cnic: "49999-9999999-1",
      phone: null,
      vehicleNumber: null,
      reason: "Repeated unauthorized access attempts",
      action: "Block",
      status: "Active",
    },
    {
      _id: id("blacklist", 2),
      name: "Warned Demo Visitor",
      cnic: "49999-9999999-2",
      phone: null,
      vehicleNumber: "WARN-DEMO-001",
      reason: "Visitor conduct warning",
      action: "Warn",
      status: "Active",
    },
    {
      _id: id("blacklist", 3),
      name: "Inactive Demo Contractor",
      cnic: "49999-9999999-3",
      phone: null,
      vehicleNumber: null,
      reason: "Old access restriction retained for audit history",
      action: "Block",
      status: "Inactive",
    },
  ].map((record) =>
    withRecordTimes(
      { ...record, addedBy: references.superAdmin._id },
      at(7, 10, 12),
    ),
  );

  return { guards, dutyRoster, vehicles, passes, visitorEntries, blacklist };
}

function buildProcurementData(references) {
  const vendorDefinitions = [
    [
      "Civic Construction Works",
      "Construction",
      "Bilal Ahmed",
      "+92 300 8100101",
      "accounts@civic-construction.demo",
    ],
    [
      "BrightSpark Electric Systems",
      "Electrical",
      "Usman Khan",
      "+92 301 8100102",
      "sales@brightspark.demo",
    ],
    [
      "FlowLine Plumbing Services",
      "Plumbing",
      "Faisal Iqbal",
      "+92 302 8100103",
      "service@flowline.demo",
    ],
    [
      "SecureGate Solutions",
      "Security",
      "Ayesha Malik",
      "+92 303 8100104",
      "hello@securegate.demo",
    ],
    [
      "CleanScope Services",
      "Cleaning",
      "Hina Noor",
      "+92 304 8100105",
      "admin@cleanscope.demo",
    ],
    [
      "OfficeTech Solutions",
      "IT",
      "Ali Raza",
      "+92 305 8100106",
      "support@officetech.demo",
    ],
  ];

  const vendors = vendorDefinitions.map((definition, offset) => {
    const index = offset + 1;
    return withRecordTimes(
      {
        _id: id("vendor", index),
        name: definition[0],
        contactPerson: definition[2],
        phone: definition[3],
        email: definition[4],
        address: `Industrial Area, Lahore, Punjab`,
        category: definition[1],
        taxId: `NTN-${String(100000 + index)}`,
        ntn: `NTN-${String(200000 + index)}`,
        documents: [],
        paymentTerms: index % 2 ? "Net 30" : "Net 45",
        status: "Active",
        performanceNotes:
          index === 1
            ? "Preferred vendor for civil work"
            : "Reliable demo vendor",
        outstandingBalance: 0,
        createdBy: references.superAdmin._id,
      },
      at(2 + offset, 4 + index, 10, index),
      at(8, 18, 10, index),
    );
  });

  const requestDefinitions = [
    [
      "Streetlight replacement fittings",
      40,
      850000,
      "Urgent",
      "High",
      "Approved",
    ],
    [
      "Water pump station spare parts",
      1,
      420000,
      "Preventive maintenance",
      "Normal",
      "Approved",
    ],
    [
      "Boundary wall repair material",
      120,
      680000,
      "Rain-damage repair",
      "High",
      "Approved",
    ],
    [
      "Security gate controller upgrade",
      1,
      325000,
      "Security improvement",
      "Normal",
      "Approved",
    ],
    [
      "Office printer maintenance kit",
      3,
      145000,
      "Preventive maintenance",
      "Low",
      "Approved",
    ],
    [
      "Community hall furniture repair",
      1,
      275000,
      "Member facility maintenance",
      "Normal",
      "Pending",
    ],
  ];

  const purchaseRequests = requestDefinitions.map((definition, offset) => {
    const index = offset + 1;
    const approved = definition[5] === "Approved";
    return withRecordTimes(
      {
        _id: id("purchase-request", index),
        requestNumber: businessNumber("PR", 1000 + index),
        requestedBy: references.superAdmin._id,
        department:
          index === 2 ? "Finance" : index === 4 ? "Security" : "Operations",
        itemDescription: definition[0],
        quantity: definition[1],
        estimatedCost: definition[2],
        justification: definition[3],
        requiredDate: dateOnly(8 + (index % 3), 10 + index),
        priority: definition[4],
        status: definition[5],
        approvedBy: approved ? references.superAdmin._id : null,
        approvedAt: approved ? at(5 + index, 12, 11, index) : null,
        rejectionReason: null,
        documents: [],
        remarks: null,
        createdBy: references.superAdmin._id,
      },
      at(4 + offset, 3 + index, 10, index),
      approved
        ? at(5 + index, 12, 11, index)
        : at(4 + offset, 3 + index, 10, index),
    );
  });

  const quotations = [];
  for (let requestIndex = 0; requestIndex < 5; requestIndex += 1) {
    const request = purchaseRequests[requestIndex];
    const primaryVendor = vendors[requestIndex];
    const secondaryVendor = vendors[(requestIndex + 1) % vendors.length];
    const baseAmount = request.estimatedCost;
    const quoteItems = [
      {
        item: request.itemDescription,
        quantity: request.quantity,
        unitPrice: Math.round(baseAmount / request.quantity),
        totalPrice: baseAmount,
        description: `Quotation for ${request.itemDescription}`,
      },
    ];

    quotations.push(
      withRecordTimes(
        {
          _id: id("quotation", requestIndex + 1, 1),
          quotationNumber: businessNumber("QT", 1000 + requestIndex * 2 + 1),
          purchaseRequest: request._id,
          vendor: primaryVendor._id,
          amount: roundMoney(baseAmount * 0.97),
          currency: "PKR",
          validUntil: dateOnly(7, 28),
          paymentTerms: "30% advance, balance on delivery",
          deliveryTerms: "Delivered to society warehouse",
          warrantyTerms: "12 months warranty",
          items: quoteItems.map((item) => {
            const totalPrice = roundMoney(item.totalPrice * 0.97);
            return {
              ...item,
              unitPrice: Math.round(totalPrice / item.quantity),
              totalPrice,
            };
          }),
          documents: [],
          status: "Selected",
          remarks: "Best evaluated commercial offer",
          createdBy: references.superAdmin._id,
        },
        at(5 + requestIndex, 14, 11, requestIndex),
      ),
      withRecordTimes(
        {
          _id: id("quotation", requestIndex + 1, 2),
          quotationNumber: businessNumber("QT", 1000 + requestIndex * 2 + 2),
          purchaseRequest: request._id,
          vendor: secondaryVendor._id,
          amount: roundMoney(baseAmount * 1.04),
          currency: "PKR",
          validUntil: dateOnly(7, 28),
          paymentTerms: "Balance after installation",
          deliveryTerms: "Installation included",
          warrantyTerms: "6 months warranty",
          items: quoteItems.map((item) => {
            const totalPrice = roundMoney(item.totalPrice * 1.04);
            return {
              ...item,
              unitPrice: Math.round(totalPrice / item.quantity),
              totalPrice,
            };
          }),
          documents: [],
          status: requestIndex % 2 ? "Rejected" : "Submitted",
          remarks:
            requestIndex % 2
              ? "Higher evaluated cost"
              : "Alternative supplier quotation",
          createdBy: references.superAdmin._id,
        },
        at(5 + requestIndex, 16, 11, requestIndex),
      ),
    );
  }

  const purchaseOrders = purchaseRequests.slice(0, 5).map((request, offset) => {
    const index = offset + 1;
    const selectedQuotation = quotations[offset * 2];
    const status =
      index <= 2 ? "Completed" : index === 3 ? "PartiallyReceived" : "Sent";
    const totalAmount = selectedQuotation.amount;
    return withRecordTimes(
      {
        _id: id("purchase-order", index),
        poNumber: businessNumber("PO", 1000 + index),
        purchaseRequest: request._id,
        selectedVendor: selectedQuotation.vendor,
        selectedQuotation: selectedQuotation._id,
        items: selectedQuotation.items,
        totalAmount,
        currency: "PKR",
        paymentTerms: selectedQuotation.paymentTerms,
        deliveryTerms: selectedQuotation.deliveryTerms,
        deliveryDate: dateOnly(6 + index, 18),
        status,
        approvedBy: references.superAdmin._id,
        approvedAt: at(5 + index, 16, 12, index),
        sentAt: at(5 + index, 18, 12, index),
        completedAt: status === "Completed" ? dateOnly(7, 18 + index) : null,
        cancelledAt: null,
        cancellationReason: null,
        documents: [],
        remarks: null,
        createdBy: references.superAdmin._id,
      },
      at(5 + index, 15, 12, index),
      status === "Completed"
        ? dateOnly(7, 18 + index)
        : at(6 + index, 18, 12, index),
    );
  });

  const grns = purchaseOrders.slice(0, 4).map((order, offset) => {
    const index = offset + 1;
    const partial = order.status === "PartiallyReceived";
    return withRecordTimes(
      {
        _id: id("grn", index),
        grnNumber: businessNumber("GRN", 1000 + index),
        purchaseOrder: order._id,
        vendor: order.selectedVendor,
        items: order.items.map((item) => ({
          item: item.item,
          orderedQty: item.quantity,
          receivedQty: partial
            ? Math.max(1, Math.ceil(item.quantity / 2))
            : item.quantity,
          rejectedQty: partial ? Math.floor(item.quantity / 4) : 0,
          qualityCheckNote: partial
            ? "Partial delivery pending remaining stock"
            : "Quality check passed",
          remarks: null,
        })),
        receivedBy: references.superAdmin._id,
        date: partial ? dateOnly(8, 10 + index) : dateOnly(7, 18 + index),
        deliveryChallanNo: `DC-DEMO-${String(1000 + index)}`,
        inspectionStatus: partial ? "PartiallyPassed" : "Passed",
        remarks: null,
        documents: [],
        createdBy: references.superAdmin._id,
      },
      partial ? at(8, 10 + index, 11, index) : at(7, 18 + index, 11, index),
    );
  });

  const expenseCategories = [
    "Utilities",
    "Repairs & Maintenance",
    "Security",
    "Cleaning",
    "Office Supplies",
    "Utilities",
    "Repairs & Maintenance",
    "Professional Fees",
    "Transport",
    "Community Events",
  ];
  const expenses = expenseCategories.map((category, offset) => {
    const index = offset + 1;
    const status = index <= 6 ? "Paid" : index <= 8 ? "Approved" : "Pending";
    const createdAt = at(4 + (offset % 5), 3 + offset, 13, index);
    const amount = 18000 + index * 7500;
    return withRecordTimes(
      {
        _id: id("expense", index),
        category,
        vendor: vendors[index % vendors.length]._id,
        amount,
        date: createdAt.slice(0, 10),
        supportingDocuments: [],
        status,
        approvedBy: status === "Pending" ? null : references.superAdmin._id,
        rejectedBy: null,
        paidAt: status === "Paid" ? addDays(createdAt, 2) : null,
        createdBy: references.superAdmin._id,
      },
      createdAt,
      status === "Paid" ? addDays(createdAt, 2) : createdAt,
    );
  });

  for (const vendor of vendors) {
    vendor.outstandingBalance = expenses
      .filter(
        (expense) => expense.vendor === vendor._id && expense.status !== "Paid",
      )
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

  return {
    vendors,
    purchaseRequests,
    quotations,
    purchaseOrders,
    grns,
    expenses,
  };
}

const stage = (name, status, actedAt, remarks = null) => ({
  stage: name,
  status,
  approver: null,
  actedAt,
  remarks,
});

function buildWorkflowData(members, plots, references) {
  const transferDefinitions = [
    {
      plot: 3,
      from: 1,
      to: 2,
      status: "Completed",
      duesCleared: true,
      outstandingDues: 0,
    },
    {
      plot: 8,
      from: 7,
      to: 29,
      status: "PendingVerification",
      duesCleared: false,
      outstandingDues: 45000,
    },
    {
      plot: 10,
      from: 9,
      to: 1,
      status: "PendingApproval",
      duesCleared: true,
      outstandingDues: 0,
    },
    {
      plot: 12,
      from: 11,
      to: 29,
      status: "Rejected",
      duesCleared: false,
      outstandingDues: 120000,
    },
  ];

  const transferRequests = transferDefinitions.map((definition, offset) => {
    const index = offset + 1;
    const createdAt = at(6 + offset, 12, 11, index);
    const stages = [];
    if (definition.status === "PendingVerification") {
      stages.push(stage("Verification", "Pending", null));
      stages.push(stage("Approval", "Pending", null));
    } else if (definition.status === "PendingApproval") {
      stages.push(
        stage(
          "Verification",
          "Completed",
          addDays(createdAt, 1),
          "Member dues verified",
        ),
      );
      stages.push(stage("Approval", "Pending", null));
    } else if (definition.status === "Rejected") {
      stages.push(
        stage(
          "Verification",
          "Rejected",
          addDays(createdAt, 2),
          "Outstanding dues prevent transfer",
        ),
      );
      stages.push(stage("Approval", "Pending", null));
    } else {
      stages.push(
        stage(
          "Verification",
          "Completed",
          addDays(createdAt, 1),
          "Member dues verified",
        ),
      );
      stages.push(
        stage(
          "Approval",
          "Completed",
          addDays(createdAt, 3),
          "Transfer approved",
        ),
      );
    }
    return withRecordTimes(
      {
        _id: id("transfer", index),
        plot: plots[definition.plot - 1]._id,
        fromMember: members[definition.from]._id,
        toMember: members[definition.to]._id,
        type: "Ownership Transfer",
        documents: [],
        transferFee: 25000,
        status: definition.status,
        duesCleared: definition.duesCleared,
        outstandingDues: definition.outstandingDues,
        approvalStages: stages.map((item) => ({
          ...item,
          approver: ["Completed", "Rejected"].includes(item.status)
            ? references.superAdmin._id
            : null,
        })),
        rejectionRemarks:
          definition.status === "Rejected"
            ? "Outstanding dues must be cleared before resubmission."
            : null,
        completedAt:
          definition.status === "Completed" ? addDays(createdAt, 4) : null,
        createdBy: references.superAdmin._id,
      },
      createdAt,
      addDays(createdAt, definition.status === "PendingVerification" ? 0 : 3),
    );
  });

  const nocDefinitions = [
    {
      member: 1,
      plot: 2,
      type: "Construction",
      status: "Issued",
      dues: 0,
      paid: true,
    },
    {
      member: 7,
      plot: 8,
      type: "Transfer",
      status: "Approved",
      dues: 35000,
      paid: true,
    },
    {
      member: 9,
      plot: 10,
      type: "Mortgage",
      status: "DuesPending",
      dues: 85000,
      paid: false,
    },
    {
      member: 11,
      plot: 12,
      type: "Utility",
      status: "Applied",
      dues: 15000,
      paid: false,
    },
    {
      member: 29,
      plot: 30,
      type: "Construction",
      status: "Rejected",
      dues: 25000,
      paid: false,
    },
  ];
  const nocs = nocDefinitions.map((definition, offset) => {
    const index = offset + 1;
    const createdAt = at(5 + offset, 16, 12, index);
    const stageStatuses = {
      Issued: ["Completed", "Completed", "Completed", "Completed", "Completed"],
      Approved: ["Completed", "Completed", "Completed", "Completed", "Pending"],
      DuesPending: ["Completed", "Pending", "Pending", "Pending", "Pending"],
      Applied: ["Pending", "Pending", "Pending", "Pending", "Pending"],
      Rejected: ["Rejected", "Pending", "Pending", "Pending", "Pending"],
    }[definition.status];
    const stageNames = ["Verification", "Dues", "Fee", "Approval", "Issue"];
    return withRecordTimes(
      {
        _id: id("noc", index),
        member: members[definition.member]._id,
        plot: plots[definition.plot - 1]._id,
        nocType: definition.type,
        feeAmount: 15000 + index * 2500,
        documents: [],
        status: definition.status,
        duesCleared: definition.dues === 0,
        outstandingDues: definition.dues,
        feePaid: definition.paid,
        feePaidAt: definition.paid ? addDays(createdAt, 2) : null,
        issuedNocNumber:
          definition.status === "Issued" ? businessNumber("NOC", 1001) : null,
        issuedDate:
          definition.status === "Issued"
            ? addDays(createdAt, 5).slice(0, 10)
            : null,
        qrVerificationToken:
          definition.status === "Issued" ? fullHash("noc-token", index) : null,
        approvalStages: stageStatuses.map((status, stageIndex) => {
          const workflowStage = stage(
            stageNames[stageIndex],
            status,
            ["Pending", "Rejected"].includes(status)
              ? null
              : addDays(createdAt, stageIndex + 1),
            status === "Rejected"
              ? "Documents did not meet verification requirements"
              : null,
          );
          return {
            ...workflowStage,
            approver: ["Completed", "Rejected"].includes(status)
              ? references.superAdmin._id
              : null,
          };
        }),
        createdBy: references.superAdmin._id,
      },
      createdAt,
      addDays(createdAt, definition.status === "Applied" ? 0 : 5),
    );
  });

  const possessionDefinitions = [
    { member: 4, plot: 5, status: "Possessed", dues: 0 },
    { member: 7, plot: 8, status: "Approved", dues: 0 },
    { member: 9, plot: 10, status: "UnderVerification", dues: 65000 },
    { member: 11, plot: 12, status: "Applied", dues: 110000 },
  ];
  const possessionApplications = possessionDefinitions.map(
    (definition, offset) => {
      const index = offset + 1;
      const createdAt = at(4 + offset, 18, 11, index);
      const completed = definition.status === "Possessed";
      const approved = completed || definition.status === "Approved";
      const verified = definition.status !== "Applied";
      const stageStatuses = completed
        ? ["Completed", "Completed", "Completed", "Completed"]
        : approved
          ? ["Completed", "Completed", "Completed", "Pending"]
          : verified
            ? ["Completed", "Pending", "Pending", "Pending"]
            : ["Pending", "Pending", "Pending", "Pending"];
      return withRecordTimes(
        {
          _id: id("possession", index),
          member: members[definition.member]._id,
          plot: plots[definition.plot - 1]._id,
          possessionCharges: 75000 + index * 10000,
          utilities: {
            electricity: index * 3500,
            gas: index * 1800,
            water: index * 2200,
          },
          status: definition.status,
          eligibilityVerified: verified,
          duesVerified: definition.dues === 0,
          siteReadinessVerified: approved,
          chargesPaid: completed,
          chargesPaidAt: completed ? addDays(createdAt, 3) : null,
          outstandingDues: definition.dues,
          handoverDate: completed ? addDays(createdAt, 4).slice(0, 10) : null,
          possessionLetterUrl: completed
            ? "https://demo.housing.local/possession/possession-0001.pdf"
            : null,
          approvalStages: [
            "Verification",
            "Charges",
            "Approval",
            "Possession",
          ].map((name, stageIndex) => {
            const status = stageStatuses[stageIndex];
            return {
              ...stage(
                name,
                status,
                status === "Completed"
                  ? addDays(createdAt, stageIndex + 1)
                  : null,
              ),
              approver:
                status === "Completed" ? references.superAdmin._id : null,
            };
          }),
          createdBy: references.superAdmin._id,
        },
        createdAt,
        completed ? addDays(createdAt, 4) : addDays(createdAt, 1),
      );
    },
  );

  const constructionDefinitions = [
    { member: 1, plot: 2, type: "Construction", status: "Approved" },
    { member: 5, plot: 6, type: "Construction", status: "UnderReview" },
    { member: 6, plot: 7, type: "Renovation", status: "Applied" },
    { member: 8, plot: 9, type: "BoundaryWall", status: "Rejected" },
  ];
  const constructionApplications = constructionDefinitions.map(
    (definition, offset) => {
      const index = offset + 1;
      const createdAt = at(3 + offset, 14, 11, index);
      const approved = definition.status === "Approved";
      const reviewed =
        approved ||
        definition.status === "UnderReview" ||
        definition.status === "Rejected";
      return withRecordTimes(
        {
          _id: id("construction", index),
          member: members[definition.member]._id,
          plot: plots[definition.plot - 1]._id,
          applicationType: definition.type,
          documents: [],
          fees: {
            amount: 50000 + index * 10000,
            paid: approved,
            receiptNumber: approved ? `CON-REC-${index}` : null,
          },
          status: definition.status,
          reviewStatus:
            definition.status === "UnderReview"
              ? "SiteInspectionPending"
              : definition.status,
          reviewedBy: reviewed ? references.superAdmin._id : null,
          reviewedAt: reviewed ? addDays(createdAt, 2) : null,
          approvedBy: approved ? references.superAdmin._id : null,
          approvedAt: approved ? addDays(createdAt, 4) : null,
          rejectionRemarks:
            definition.status === "Rejected"
              ? "Incomplete boundary-wall design documents."
              : null,
          completionCertificateUrl: approved
            ? `https://demo.housing.local/construction/certificate-${index}.pdf`
            : null,
          createdBy: references.superAdmin._id,
        },
        createdAt,
        approved ? addDays(createdAt, 4) : addDays(createdAt, 2),
      );
    },
  );

  const siteInspections = [
    {
      application: constructionApplications[0],
      date: dateOnly(7, 18),
      findings: "Site work is complete and complies with approved drawings.",
      violations: [],
      correctiveActionsRequired: false,
      reinspectionRequired: false,
      reinspectionDate: null,
    },
    {
      application: constructionApplications[1],
      date: dateOnly(8, 19),
      findings: "Initial inspection found a boundary safety issue.",
      violations: [
        {
          code: "SAFE-01",
          description: "Temporary boundary protection is incomplete.",
          status: "Open",
          correctiveActionDue: dateOnly(8, 28),
        },
      ],
      correctiveActionsRequired: true,
      reinspectionRequired: true,
      reinspectionDate: dateOnly(8, 29),
    },
  ].map((definition, offset) => {
    const index = offset + 1;
    return withRecordTimes(
      {
        _id: id("site-inspection", index),
        application: definition.application._id,
        inspectorUser: references.superAdmin._id,
        date: definition.date,
        findings: definition.findings,
        violations: definition.violations,
        correctiveActionsRequired: definition.correctiveActionsRequired,
        reinspectionRequired: definition.reinspectionRequired,
        reinspectionDate: definition.reinspectionDate,
      },
      `${definition.date}T10:00:00.000Z`,
    );
  });

  return {
    transferRequests,
    nocs,
    possessionApplications,
    constructionApplications,
    siteInspections,
  };
}

function updateNumberingRules(datasets) {
  const requiredSequences = {
    member: 1030,
    plot: 1040,
    receipt: 1018,
    noc: 1001,
    complaint: 1015,
    purchaseRequest: 1006,
    quotation: 1010,
    purchaseOrder: 1005,
    grn: 1004,
  };

  const rules = db.data.numberingRules || [];
  for (const [entityType, minimumSequence] of Object.entries(
    requiredSequences,
  )) {
    const rule = rules.find((record) => record.entityType === entityType);
    if (!rule) {
      throw new Error(
        `Missing numbering rule for ${entityType}. Run npm run seed first.`,
      );
    }
    rule.currentSequence = Math.max(
      Number(rule.currentSequence) || 0,
      minimumSequence,
    );
    if (rule.resetPolicy === "Yearly" && minimumSequence > 0) {
      rule.lastResetAt = `${YEAR}-01-01T00:00:00.000Z`;
    }
    rule.updatedAt = REFERENCE_DATE;
  }

  return datasets;
}

function upsertDemoData(datasets) {
  for (const [collectionName, records] of Object.entries(datasets)) {
    const collection = Array.isArray(db.data[collectionName])
      ? db.data[collectionName]
      : [];
    const byId = new Map(collection.map((record) => [record._id, record]));

    for (const record of records) {
      if (byId.has(record._id)) {
        Object.assign(byId.get(record._id), clone(record));
      } else {
        const inserted = clone(record);
        collection.push(inserted);
        byId.set(inserted._id, inserted);
      }
    }

    db.data[collectionName] = collection;
  }
}

function ensureUnique(records, keyFactory, label) {
  const seen = new Set();
  for (const record of records) {
    const key = keyFactory(record);
    if (key == null || key === "") continue;
    if (seen.has(key)) {
      throw new Error(`Duplicate ${label}: ${key}`);
    }
    seen.add(key);
  }
}

function validateDevelopmentData(datasets) {
  const managedIds = new Set();
  for (const records of Object.values(datasets)) {
    for (const record of records) managedIds.add(record._id);
  }

  const idsByCollection = {};
  for (const [collectionName, records] of Object.entries(datasets)) {
    idsByCollection[collectionName] = new Set(
      records.map((record) => record._id),
    );
  }

  const allIds = new Set();
  for (const [collectionName, records] of Object.entries(db.data)) {
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      if (record?._id && allIds.has(record._id)) {
        throw new Error(
          `Duplicate _id ${record._id} detected in ${collectionName}`,
        );
      }
      if (record?._id) allIds.add(record._id);
    }
  }

  const checkRef = (
    record,
    field,
    targetCollection,
    optional = true,
    label = field,
  ) => {
    if (!managedIds.has(record._id)) return;
    const value = record[field];
    if ((value === null || value === undefined || value === "") && optional)
      return;
    if (!allIds.has(value)) {
      throw new Error(
        `${label} in ${record._id} references missing ${targetCollection} ${value}`,
      );
    }
  };

  const referenceChecks = [
    ["plots", "currentOwner", "members", true],
    ["ownershipHistory", "plot", "plots", false],
    ["ownershipHistory", "member", "members", false],
    ["bookings", "member", "members", false],
    ["bookings", "plot", "plots", false],
    ["installmentPlans", "booking", "bookings", false],
    ["installments", "plan", "installmentPlans", false],
    ["installments", "member", "members", false],
    ["installments", "plot", "plots", false],
    ["payments", "member", "members", false],
    ["payments", "plot", "plots", true],
    ["complaints", "member", "members", false],
    ["complaints", "plot", "plots", true],
    ["complaints", "assignedDepartment", "departments", false],
    ["complaints", "assignedStaff", "users", true],
    ["workOrders", "asset", "assets", false],
    ["workOrders", "relatedComplaint", "complaints", false],
    ["workOrders", "assignedStaff", "users", true],
    ["attendance", "employee", "employees", false],
    ["leaveRequests", "employee", "employees", false],
    ["leaveRequests", "approvedBy", "users", true],
    ["dutyRoster", "guard", "guards", false],
    ["vehicles", "owner", "members", false],
    ["passes", "relatedMember", "members", true],
    ["visitorEntries", "hostMember", "members", false],
    ["visitorEntries", "passId", "passes", true],
    ["purchaseRequests", "requestedBy", "users", false],
    ["purchaseRequests", "approvedBy", "users", true],
    ["quotations", "purchaseRequest", "purchaseRequests", false],
    ["quotations", "vendor", "vendors", false],
    ["purchaseOrders", "purchaseRequest", "purchaseRequests", false],
    ["purchaseOrders", "selectedVendor", "vendors", false],
    ["purchaseOrders", "selectedQuotation", "quotations", true],
    ["grns", "purchaseOrder", "purchaseOrders", false],
    ["grns", "vendor", "vendors", false],
    ["expenses", "vendor", "vendors", false],
    ["transferRequests", "plot", "plots", false],
    ["transferRequests", "fromMember", "members", false],
    ["transferRequests", "toMember", "members", false],
    ["nocs", "member", "members", false],
    ["nocs", "plot", "plots", false],
    ["possessionApplications", "member", "members", false],
    ["possessionApplications", "plot", "plots", false],
    ["constructionApplications", "member", "members", false],
    ["constructionApplications", "plot", "plots", false],
    ["siteInspections", "application", "constructionApplications", false],
    ["siteInspections", "inspectorUser", "users", false],
  ];

  for (const [
    collectionName,
    field,
    targetCollection,
    optional,
  ] of referenceChecks) {
    for (const record of datasets[collectionName] || []) {
      checkRef(record, field, targetCollection, optional);
    }
  }

  for (const payment of datasets.payments) {
    const allocated = payment.allocations.reduce(
      (sum, allocation) => sum + allocation.amountApplied,
      0,
    );
    if (allocated !== payment.amount) {
      throw new Error(`Payment ${payment._id} allocation mismatch`);
    }
    for (const allocation of payment.allocations) {
      if (!allIds.has(allocation.installment)) {
        throw new Error(
          `Payment ${payment._id} references missing installment ${allocation.installment}`,
        );
      }
    }
  }

  for (const installment of datasets.installments) {
    const allocated = datasets.payments
      .flatMap((payment) => payment.allocations)
      .filter((allocation) => allocation.installment === installment._id)
      .reduce((sum, allocation) => sum + allocation.amountApplied, 0);
    if (allocated !== installment.paidAmount) {
      throw new Error(
        `Installment ${installment._id} payment reconciliation mismatch`,
      );
    }
  }

  for (const plot of datasets.plots.filter((record) => record.currentOwner)) {
    const openHistory = datasets.ownershipHistory.find(
      (history) =>
        history.plot === plot._id &&
        history.member === plot.currentOwner &&
        history.toDate === null,
    );
    if (!openHistory) {
      throw new Error(
        `Plot ${plot._id} has no open ownership history for its current owner`,
      );
    }
  }

  for (const application of datasets.constructionApplications.filter(
    (record) => record.status === "Approved",
  )) {
    const inspections = datasets.siteInspections.filter(
      (record) => record.application === application._id,
    );
    if (
      !inspections.length ||
      inspections.some(
        (record) =>
          record.violations.length ||
          record.correctiveActionsRequired ||
          record.reinspectionRequired,
      )
    ) {
      throw new Error(
        `Approved construction application ${application._id} does not have a clean inspection`,
      );
    }
  }

  ensureUnique(datasets.members, (record) => record.cnic, "member CNIC");
  ensureUnique(datasets.members, (record) => record.phone, "member phone");
  ensureUnique(datasets.members, (record) => record.memberId, "member number");
  ensureUnique(datasets.plots, (record) => record.plotNumber, "plot number");
  ensureUnique(
    datasets.employees,
    (record) => record.employeeId,
    "employee number",
  );
  ensureUnique(datasets.vehicles, (record) => record.number, "vehicle number");
  ensureUnique(datasets.passes, (record) => record.passNumber, "pass number");
  ensureUnique(datasets.vendors, (record) => record.name, "vendor name");
  ensureUnique(
    datasets.attendance,
    (record) => `${record.employee}:${record.date}`,
    "employee attendance",
  );
  ensureUnique(
    datasets.dutyRoster,
    (record) => `${record.guard}:${record.date}`,
    "guard roster",
  );

  return {
    managedRecords: managedIds.size,
    collections: Object.keys(datasets).length,
    relationshipChecks: referenceChecks.length,
  };
}

async function seedDevelopmentData() {
  if (env.isProd) {
    throw new Error(
      "Development demo data cannot be seeded when NODE_ENV=production.",
    );
  }

  await connectDB();
  const references = await loadReferences();
  const snapshot = clone(db.data);

  try {
    const members = buildMembers(references.superAdmin._id);
    const plots = buildPlots(members, references);
    const ownershipHistory = buildOwnershipHistory(plots, members);
    const financialData = buildFinancialData(members, plots);
    const operationalData = buildOperationalData(members, plots, references);
    const hrData = buildHrData(members, references);
    const securityData = buildSecurityData(members, references);
    const procurementData = buildProcurementData(references);
    const workflowData = buildWorkflowData(members, plots, references);

    for (const dataset of [
      financialData,
      operationalData,
      hrData,
      securityData,
      procurementData,
      workflowData,
    ]) {
      for (const [collectionName, records] of Object.entries(dataset)) {
        records.forEach((record) => {
          if (
            ["bookings", "payments"].includes(collectionName) &&
            record.createdBy === null
          ) {
            record.createdBy = references.superAdmin._id;
          }
          if (collectionName === "payments" && record.collectedBy === null) {
            record.collectedBy = references.superAdmin._id;
          }
          if (collectionName === "bookings" && record.status === "Confirmed") {
            record.approvedBy = references.superAdmin._id;
          }
        });
      }
    }

    const datasets = {
      [COLLECTIONS.members]: members,
      [COLLECTIONS.plots]: plots,
      [COLLECTIONS.ownershipHistory]: ownershipHistory,
      [COLLECTIONS.bookings]: financialData.bookings,
      [COLLECTIONS.installmentPlans]: financialData.plans,
      [COLLECTIONS.installments]: financialData.installments,
      [COLLECTIONS.payments]: financialData.payments,
      [COLLECTIONS.complaints]: operationalData.complaints,
      [COLLECTIONS.assets]: operationalData.assets,
      [COLLECTIONS.workOrders]: operationalData.workOrders,
      [COLLECTIONS.employees]: hrData.employees,
      [COLLECTIONS.attendance]: hrData.attendance,
      [COLLECTIONS.leaveRequests]: hrData.leaveRequests,
      [COLLECTIONS.guards]: securityData.guards,
      [COLLECTIONS.dutyRoster]: securityData.dutyRoster,
      [COLLECTIONS.vehicles]: securityData.vehicles,
      [COLLECTIONS.passes]: securityData.passes,
      [COLLECTIONS.visitorEntries]: securityData.visitorEntries,
      [COLLECTIONS.blacklist]: securityData.blacklist,
      [COLLECTIONS.vendors]: procurementData.vendors,
      [COLLECTIONS.purchaseRequests]: procurementData.purchaseRequests,
      [COLLECTIONS.quotations]: procurementData.quotations,
      [COLLECTIONS.purchaseOrders]: procurementData.purchaseOrders,
      [COLLECTIONS.grns]: procurementData.grns,
      [COLLECTIONS.expenses]: procurementData.expenses,
      [COLLECTIONS.transferRequests]: workflowData.transferRequests,
      [COLLECTIONS.nocApplications]: workflowData.nocs,
      [COLLECTIONS.possessionApplications]: workflowData.possessionApplications,
      [COLLECTIONS.constructionApplications]:
        workflowData.constructionApplications,
      [COLLECTIONS.siteInspections]: workflowData.siteInspections,
    };

    updateNumberingRules(datasets);
    upsertDemoData(datasets);
    const validation = validateDevelopmentData(datasets);

    const firstSeededAt =
      snapshot.developmentData?.firstSeededAt || new Date().toISOString();
    db.data.developmentData = {
      version: DATASET_VERSION,
      firstSeededAt,
      lastSeededAt: new Date().toISOString(),
      description: "Medium linked ERP development dataset",
      counts: Object.fromEntries(
        Object.entries(datasets).map(([name, records]) => [
          name,
          records.length,
        ]),
      ),
    };

    await db.save();

    console.log(
      `\n🌱 Development dataset ${DATASET_VERSION} seeded successfully.\n`,
    );
    console.table(
      Object.entries(datasets).map(([collection, records]) => ({
        collection,
        records: records.length,
      })),
    );
    console.log(
      `✅ ${validation.managedRecords} managed records validated across ${validation.collections} collections (${validation.relationshipChecks} relationship checks).`,
    );
    console.log(
      "✅ Existing users, roles, settings, master data and non-demo records were preserved.\n",
    );
  } catch (error) {
    db.data = snapshot;
    throw error;
  }
}

if (require.main === module) {
  seedDevelopmentData().catch((error) => {
    console.error("\n❌ Development data seed failed:", error.message);
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { DATASET_VERSION, seedDevelopmentData };
