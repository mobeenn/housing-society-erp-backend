-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "membershipNumber" TEXT,
    "name" TEXT NOT NULL,
    "cnic" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "nominee" JSONB,
    "status" TEXT,
    "photo" TEXT,
    "documents" JSONB,
    "userId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plots" (
    "id" TEXT NOT NULL,
    "plotNumber" TEXT,
    "block" TEXT,
    "street" TEXT,
    "size" TEXT,
    "category" TEXT,
    "propertyType" TEXT,
    "fileNumber" TEXT,
    "location" TEXT,
    "currentOwner" TEXT,
    "ownerSince" TIMESTAMP(3),
    "status" TEXT,
    "price" DECIMAL(14,2),
    "isBlocked" BOOLEAN,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "plots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_history" (
    "id" TEXT NOT NULL,
    "plot" TEXT NOT NULL,
    "member" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "type" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ownership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "member" TEXT NOT NULL,
    "plot" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3),
    "price" DECIMAL(14,2),
    "discount" DECIMAL(14,2),
    "developmentCharges" DECIMAL(14,2),
    "additionalCharges" DECIMAL(14,2),
    "bookingAmount" DECIMAL(14,2),
    "refundAmount" DECIMAL(14,2),
    "status" TEXT,
    "planTemplate" JSONB,
    "cancellationReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" TEXT NOT NULL,
    "booking" TEXT NOT NULL,
    "totalAmount" DECIMAL(14,2),
    "numberOfInstallments" INTEGER,
    "frequency" TEXT,
    "generatedInstallments" JSONB,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "plan" TEXT,
    "member" TEXT,
    "plot" TEXT,
    "dueDate" TIMESTAMP(3),
    "amount" DECIMAL(14,2),
    "penaltyAmount" DECIMAL(14,2),
    "discountAmount" DECIMAL(14,2),
    "paidAmount" DECIMAL(14,2),
    "balance" DECIMAL(14,2),
    "status" TEXT,
    "overdueDays" INTEGER,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "member" TEXT,
    "plot" TEXT,
    "amount" DECIMAL(14,2),
    "method" TEXT,
    "allocations" JSONB,
    "collectedBy" TEXT,
    "remarks" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "member" TEXT,
    "plot" TEXT,
    "booking" TEXT,
    "amount" DECIMAL(14,2),
    "reason" TEXT,
    "status" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejection" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "category" TEXT,
    "vendor" TEXT,
    "amount" DECIMAL(14,2),
    "date" TIMESTAMP(3),
    "supportingDocuments" JSONB,
    "status" TEXT,
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "category" TEXT,
    "taxId" TEXT,
    "ntn" TEXT,
    "documents" JSONB,
    "paymentTerms" TEXT,
    "status" TEXT,
    "performanceNotes" TEXT,
    "outstandingBalance" DECIMAL(14,2),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT,
    "requestedBy" TEXT,
    "department" TEXT,
    "itemDescription" TEXT,
    "quantity" DECIMAL(14,2),
    "estimatedCost" DECIMAL(14,2),
    "justification" TEXT,
    "requiredDate" TIMESTAMP(3),
    "priority" TEXT,
    "status" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "documents" JSONB,
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT,
    "purchaseRequest" TEXT,
    "vendor" TEXT,
    "amount" DECIMAL(14,2),
    "currency" TEXT,
    "validUntil" TIMESTAMP(3),
    "paymentTerms" TEXT,
    "deliveryTerms" TEXT,
    "warrantyTerms" TEXT,
    "items" JSONB,
    "documents" JSONB,
    "status" TEXT,
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT,
    "purchaseRequest" TEXT,
    "selectedVendor" TEXT,
    "selectedQuotation" TEXT,
    "items" JSONB,
    "totalAmount" DECIMAL(14,2),
    "currency" TEXT,
    "paymentTerms" TEXT,
    "deliveryTerms" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "status" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "documents" JSONB,
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grns" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT,
    "purchaseOrder" TEXT,
    "vendor" TEXT,
    "items" JSONB,
    "receivedBy" TEXT,
    "date" TIMESTAMP(3),
    "deliveryChallanNo" TEXT,
    "inspectionStatus" TEXT,
    "remarks" TEXT,
    "documents" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "grns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(14,2),
    "currentStock" DECIMAL(14,2),
    "reorderLevel" DECIMAL(14,2),
    "minLevel" DECIMAL(14,2),
    "status" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "type" TEXT,
    "quantity" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "remarks" TEXT,
    "balanceAfter" DECIMAL(14,2),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_requests" (
    "id" TEXT NOT NULL,
    "plot" TEXT NOT NULL,
    "fromMember" TEXT,
    "toMember" TEXT,
    "type" TEXT,
    "documents" JSONB,
    "transferFee" DECIMAL(14,2),
    "status" TEXT,
    "duesCleared" BOOLEAN,
    "outstandingDues" DECIMAL(14,2),
    "approvalStages" JSONB,
    "rejectionRemarks" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "noc_applications" (
    "id" TEXT NOT NULL,
    "member" TEXT,
    "plot" TEXT,
    "nocType" TEXT,
    "feeAmount" DECIMAL(14,2),
    "documents" JSONB,
    "status" TEXT,
    "duesCleared" BOOLEAN,
    "outstandingDues" DECIMAL(14,2),
    "feePaid" BOOLEAN,
    "feePaidAt" TIMESTAMP(3),
    "issuedNocNumber" TEXT,
    "issuedDate" TIMESTAMP(3),
    "qrVerificationToken" TEXT,
    "approvalStages" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "noc_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "possession_applications" (
    "id" TEXT NOT NULL,
    "member" TEXT,
    "plot" TEXT,
    "possessionCharges" DECIMAL(14,2),
    "utilities" JSONB,
    "status" TEXT,
    "eligibilityVerified" BOOLEAN,
    "duesVerified" BOOLEAN,
    "siteReadinessVerified" BOOLEAN,
    "chargesPaid" BOOLEAN,
    "chargesPaidAt" TIMESTAMP(3),
    "outstandingDues" DECIMAL(14,2),
    "handoverDate" TIMESTAMP(3),
    "possessionLetterUrl" TEXT,
    "approvalStages" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "possession_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_applications" (
    "id" TEXT NOT NULL,
    "member" TEXT,
    "plot" TEXT,
    "applicationType" TEXT,
    "documents" JSONB,
    "fees" JSONB,
    "status" TEXT,
    "reviewStatus" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionRemarks" TEXT,
    "completionCertificateUrl" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "construction_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_inspections" (
    "id" TEXT NOT NULL,
    "application" TEXT,
    "inspectorUser" TEXT,
    "date" TIMESTAMP(3),
    "findings" TEXT,
    "violations" JSONB,
    "correctiveActionsRequired" BOOLEAN,
    "reinspectionRequired" BOOLEAN,
    "reinspectionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "site_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "complaintNumber" TEXT,
    "member" TEXT,
    "plot" TEXT,
    "category" TEXT,
    "description" TEXT,
    "location" TEXT,
    "priority" TEXT,
    "attachments" JSONB,
    "assignedDepartment" TEXT,
    "assignedStaff" TEXT,
    "slaDueDate" TIMESTAMP(3),
    "status" TEXT,
    "comments" JSONB,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "location" TEXT,
    "block" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "asset" TEXT,
    "relatedComplaint" TEXT,
    "description" TEXT,
    "assignedStaff" TEXT,
    "contractor" TEXT,
    "priority" TEXT,
    "expectedCompletion" TIMESTAMP(3),
    "materials" JSONB,
    "laborCost" DECIMAL(14,2),
    "materialCost" DECIMAL(14,2),
    "status" TEXT,
    "progressLog" JSONB,
    "completionNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "name" TEXT NOT NULL,
    "cnic" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "joiningDate" TIMESTAMP(3),
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "emergencyContact" JSONB,
    "linkedUser" TEXT,
    "documents" JSONB,
    "basicSalary" DECIMAL(14,2),
    "allowances" DECIMAL(14,2),
    "deductions" DECIMAL(14,2),
    "bankAccount" TEXT,
    "status" TEXT,
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "employee" TEXT,
    "date" TIMESTAMP(3),
    "status" TEXT,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employee" TEXT,
    "type" TEXT,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "reason" TEXT,
    "status" TEXT,
    "balanceSnapshot" JSONB,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guards" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "supervisor" TEXT,
    "shift" TEXT,
    "status" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "guards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_roster" (
    "id" TEXT NOT NULL,
    "guard" TEXT,
    "date" TIMESTAMP(3),
    "shift" TEXT,
    "attendanceStatus" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "duty_roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "owner" TEXT,
    "number" TEXT,
    "type" TEXT,
    "model" TEXT,
    "stickerNumber" TEXT,
    "stickerIssuedAt" TIMESTAMP(3),
    "status" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passes" (
    "id" TEXT NOT NULL,
    "passNumber" TEXT,
    "type" TEXT,
    "holderName" TEXT,
    "phone" TEXT,
    "cnic" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "relatedMember" TEXT,
    "status" TEXT,
    "purpose" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklist_entries" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "cnic" TEXT,
    "phone" TEXT,
    "vehicleNumber" TEXT,
    "reason" TEXT,
    "action" TEXT,
    "status" TEXT,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "blacklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_entries" (
    "id" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "phone" TEXT,
    "cnic" TEXT,
    "hostMember" TEXT,
    "purpose" TEXT,
    "gate" TEXT,
    "vehicleNumber" TEXT,
    "entryTime" TIMESTAMP(3),
    "exitTime" TIMESTAMP(3),
    "exitMarkedBy" TEXT,
    "remarks" TEXT,
    "passId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "visitor_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "targetAudience" TEXT,
    "targetRoleIds" JSONB,
    "targetMemberIds" JSONB,
    "publishDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "eventType" TEXT,
    "eventKey" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN,
    "readAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "type" TEXT,
    "number" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileUrl" TEXT,
    "fileName" TEXT,
    "storageKey" TEXT,
    "storageBucket" TEXT,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "verificationStatus" TEXT,
    "version" INTEGER,
    "isSuperseded" BOOLEAN,
    "supersededBy" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceType" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "sourceKey" TEXT,
    "member" TEXT,
    "dealer" TEXT,
    "plot" TEXT,
    "amount" DECIMAL(14,2),
    "issueDate" TIMESTAMP(3),
    "fileUrl" TEXT,
    "storageBucket" TEXT,
    "storagePath" TEXT,
    "status" TEXT,
    "createdBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_assignments" (
    "id" TEXT NOT NULL,
    "booking" TEXT,
    "agent" TEXT,
    "assignedBy" TEXT,
    "assignedDate" TIMESTAMP(3),
    "status" TEXT,
    "recoveryPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "recovery_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_calls" (
    "id" TEXT NOT NULL,
    "assignment" TEXT,
    "calledBy" TEXT,
    "callDate" TIMESTAMP(3),
    "notes" TEXT,
    "commitmentDate" TIMESTAMP(3),
    "commitmentAmount" DECIMAL(14,2),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "recovery_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_setups" (
    "id" TEXT NOT NULL,
    "salaryComponents" JSONB,
    "statutoryConfig" JSONB,
    "taxSlabs" JSONB,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "hr_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "employee" TEXT,
    "amount" DECIMAL(14,2),
    "installmentAmount" DECIMAL(14,2),
    "remainingBalance" DECIMAL(14,2),
    "status" TEXT,
    "disbursedDate" TIMESTAMP(3),
    "lastDeductionRun" TEXT,
    "lastDeductionAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT,
    "generatedBy" TEXT,
    "approvedBy" TEXT,
    "paidBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "entries" JSONB,
    "totals" JSONB,
    "glPosting" JSONB,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "sourceType" TEXT,
    "sourceId" TEXT,
    "description" TEXT,
    "lines" JSONB,
    "totalDebit" DECIMAL(14,2),
    "totalCredit" DECIMAL(14,2),
    "status" TEXT,
    "postedBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "purpose" TEXT,
    "hostEmployee" TEXT,
    "tokenNumber" TEXT,
    "status" TEXT,
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_batches" (
    "id" TEXT NOT NULL,
    "plots" JSONB,
    "requestDate" TIMESTAMP(3),
    "status" TEXT,
    "completedDate" TIMESTAMP(3),
    "remarks" TEXT,
    "completedBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "registry_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plot_merges" (
    "id" TEXT NOT NULL,
    "mergedPlots" JSONB,
    "resultingPlot" TEXT,
    "adjustedAmounts" JSONB,
    "performedBy" TEXT,
    "date" TIMESTAMP(3),
    "status" TEXT,
    "invoiceId" TEXT,
    "invoiceUrl" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "plot_merges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buybacks" (
    "id" TEXT NOT NULL,
    "plot" TEXT,
    "booking" TEXT,
    "type" TEXT,
    "paymentType" TEXT,
    "deductionPercent" DECIMAL(5,2),
    "settlementAmount" DECIMAL(14,2),
    "performedBy" TEXT,
    "date" TIMESTAMP(3),
    "status" TEXT,
    "invoiceId" TEXT,
    "invoiceUrl" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "buybacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "members_cnic_idx" ON "members"("cnic");

-- CreateIndex
CREATE INDEX "members_memberId_idx" ON "members"("memberId");

-- CreateIndex
CREATE INDEX "plots_plotNumber_idx" ON "plots"("plotNumber");

-- CreateIndex
CREATE INDEX "plots_currentOwner_idx" ON "plots"("currentOwner");

-- CreateIndex
CREATE INDEX "ownership_history_plot_idx" ON "ownership_history"("plot");

-- CreateIndex
CREATE INDEX "ownership_history_member_idx" ON "ownership_history"("member");

-- CreateIndex
CREATE INDEX "bookings_member_idx" ON "bookings"("member");

-- CreateIndex
CREATE INDEX "bookings_plot_idx" ON "bookings"("plot");

-- CreateIndex
CREATE INDEX "installment_plans_booking_idx" ON "installment_plans"("booking");

-- CreateIndex
CREATE INDEX "installments_member_idx" ON "installments"("member");

-- CreateIndex
CREATE INDEX "installments_plot_idx" ON "installments"("plot");

-- CreateIndex
CREATE INDEX "installments_dueDate_idx" ON "installments"("dueDate");

-- CreateIndex
CREATE INDEX "installments_status_idx" ON "installments"("status");

-- CreateIndex
CREATE INDEX "payments_member_idx" ON "payments"("member");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "refunds_member_idx" ON "refunds"("member");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "vendors_name_idx" ON "vendors"("name");

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- CreateIndex
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests"("status");

-- CreateIndex
CREATE INDEX "quotations_vendor_idx" ON "quotations"("vendor");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_selectedVendor_idx" ON "purchase_orders"("selectedVendor");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "grns_purchaseOrder_idx" ON "grns"("purchaseOrder");

-- CreateIndex
CREATE INDEX "grns_vendor_idx" ON "grns"("vendor");

-- CreateIndex
CREATE INDEX "inventory_items_sku_idx" ON "inventory_items"("sku");

-- CreateIndex
CREATE INDEX "inventory_items_category_idx" ON "inventory_items"("category");

-- CreateIndex
CREATE INDEX "stock_transactions_item_idx" ON "stock_transactions"("item");

-- CreateIndex
CREATE INDEX "stock_transactions_type_idx" ON "stock_transactions"("type");

-- CreateIndex
CREATE INDEX "transfer_requests_plot_idx" ON "transfer_requests"("plot");

-- CreateIndex
CREATE INDEX "transfer_requests_status_idx" ON "transfer_requests"("status");

-- CreateIndex
CREATE INDEX "noc_applications_member_idx" ON "noc_applications"("member");

-- CreateIndex
CREATE INDEX "noc_applications_plot_idx" ON "noc_applications"("plot");

-- CreateIndex
CREATE INDEX "noc_applications_qrVerificationToken_idx" ON "noc_applications"("qrVerificationToken");

-- CreateIndex
CREATE INDEX "possession_applications_member_idx" ON "possession_applications"("member");

-- CreateIndex
CREATE INDEX "possession_applications_plot_idx" ON "possession_applications"("plot");

-- CreateIndex
CREATE INDEX "construction_applications_member_idx" ON "construction_applications"("member");

-- CreateIndex
CREATE INDEX "construction_applications_plot_idx" ON "construction_applications"("plot");

-- CreateIndex
CREATE INDEX "site_inspections_application_idx" ON "site_inspections"("application");

-- CreateIndex
CREATE INDEX "complaints_member_idx" ON "complaints"("member");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "work_orders_asset_idx" ON "work_orders"("asset");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE INDEX "employees_employeeId_idx" ON "employees"("employeeId");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "attendance_employee_idx" ON "attendance"("employee");

-- CreateIndex
CREATE INDEX "attendance_status_idx" ON "attendance"("status");

-- CreateIndex
CREATE INDEX "leave_requests_employee_idx" ON "leave_requests"("employee");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "guards_user_idx" ON "guards"("user");

-- CreateIndex
CREATE INDEX "guards_status_idx" ON "guards"("status");

-- CreateIndex
CREATE INDEX "duty_roster_guard_idx" ON "duty_roster"("guard");

-- CreateIndex
CREATE INDEX "duty_roster_date_idx" ON "duty_roster"("date");

-- CreateIndex
CREATE INDEX "vehicles_number_idx" ON "vehicles"("number");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "passes_passNumber_idx" ON "passes"("passNumber");

-- CreateIndex
CREATE INDEX "passes_cnic_idx" ON "passes"("cnic");

-- CreateIndex
CREATE INDEX "passes_status_idx" ON "passes"("status");

-- CreateIndex
CREATE INDEX "blacklist_entries_cnic_idx" ON "blacklist_entries"("cnic");

-- CreateIndex
CREATE INDEX "blacklist_entries_vehicleNumber_idx" ON "blacklist_entries"("vehicleNumber");

-- CreateIndex
CREATE INDEX "visitor_entries_hostMember_idx" ON "visitor_entries"("hostMember");

-- CreateIndex
CREATE INDEX "visitor_entries_entryTime_idx" ON "visitor_entries"("entryTime");

-- CreateIndex
CREATE INDEX "notifications_user_idx" ON "notifications"("user");

-- CreateIndex
CREATE INDEX "documents_relatedEntityType_relatedEntityId_idx" ON "documents"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "invoices_invoiceType_idx" ON "invoices"("invoiceType");

-- CreateIndex
CREATE INDEX "invoices_storageBucket_idx" ON "invoices"("storageBucket");

-- CreateIndex
CREATE INDEX "recovery_assignments_booking_idx" ON "recovery_assignments"("booking");

-- CreateIndex
CREATE INDEX "recovery_assignments_agent_idx" ON "recovery_assignments"("agent");

-- CreateIndex
CREATE INDEX "recovery_calls_assignment_idx" ON "recovery_calls"("assignment");

-- CreateIndex
CREATE INDEX "loans_employee_idx" ON "loans"("employee");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_year_month_key" ON "payroll_runs"("year", "month");

-- CreateIndex
CREATE INDEX "journal_entries_status_idx" ON "journal_entries"("status");

-- CreateIndex
CREATE INDEX "registry_batches_status_idx" ON "registry_batches"("status");

-- CreateIndex
CREATE INDEX "plot_merges_resultingPlot_idx" ON "plot_merges"("resultingPlot");

-- CreateIndex
CREATE INDEX "buybacks_plot_idx" ON "buybacks"("plot");

-- CreateIndex
CREATE INDEX "buybacks_booking_idx" ON "buybacks"("booking");
