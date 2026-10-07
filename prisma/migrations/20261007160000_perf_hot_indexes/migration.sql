-- Phase 2 performance: hot-column indexes (additive only)

-- Member
CREATE INDEX "members_status_idx" ON "members"("status");
CREATE INDEX "members_phone_idx" ON "members"("phone");
CREATE INDEX "members_createdAt_idx" ON "members"("createdAt");

-- Plot
CREATE INDEX "plots_status_idx" ON "plots"("status");
CREATE INDEX "plots_block_idx" ON "plots"("block");
CREATE INDEX "plots_street_idx" ON "plots"("street");
CREATE INDEX "plots_fileNumber_idx" ON "plots"("fileNumber");
CREATE INDEX "plots_isBlocked_idx" ON "plots"("isBlocked");
CREATE INDEX "plots_createdAt_idx" ON "plots"("createdAt");

-- Booking
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
CREATE INDEX "bookings_createdAt_idx" ON "bookings"("createdAt");

-- Payment
CREATE INDEX "payments_plot_idx" ON "payments"("plot");
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");
CREATE INDEX "payments_receiptNumber_idx" ON "payments"("receiptNumber");

-- Invoice
CREATE INDEX "invoices_member_idx" ON "invoices"("member");
CREATE INDEX "invoices_plot_idx" ON "invoices"("plot");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");
CREATE INDEX "invoices_issueDate_idx" ON "invoices"("issueDate");
CREATE INDEX "invoices_invoiceNumber_idx" ON "invoices"("invoiceNumber");

-- RecoveryAssignment
CREATE INDEX "recovery_assignments_status_idx" ON "recovery_assignments"("status");

-- RoleModuleAccess
CREATE INDEX "role_module_access_moduleId_idx" ON "role_module_access"("moduleId");

-- Appointment / Notice
CREATE INDEX "appointments_createdAt_idx" ON "appointments"("createdAt");
CREATE INDEX "notices_createdAt_idx" ON "notices"("createdAt");
