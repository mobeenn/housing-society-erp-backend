-- ══════════════════════════════════════════════════════════════
-- CHECK CONSTRAINTS
-- ══════════════════════════════════════════════════════════════

-- Amounts >= 0 (all money columns)
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_price_check" CHECK ("price" >= 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_discount_check" CHECK ("discount" >= 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_development_charges_check" CHECK ("developmentCharges" >= 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_additional_charges_check" CHECK ("additionalCharges" >= 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_amount_check" CHECK ("bookingAmount" >= 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_refund_amount_check" CHECK ("refundAmount" >= 0);

ALTER TABLE "installments" ADD CONSTRAINT "installments_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "installments" ADD CONSTRAINT "installments_paid_amount_check" CHECK ("paidAmount" >= 0);
ALTER TABLE "installments" ADD CONSTRAINT "installments_balance_check" CHECK ("balance" >= 0);
ALTER TABLE "installments" ADD CONSTRAINT "installments_late_fee_check" CHECK ("lateFee" >= 0);

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount" >= 0);

ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_check" CHECK ("amount" >= 0);

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_check" CHECK ("amount" >= 0);

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_check" CHECK ("amount" >= 0);

ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_total_debit_check" CHECK ("totalDebit" >= 0);
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_total_credit_check" CHECK ("totalCredit" >= 0);

ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_debit_check" CHECK ("debit" >= 0);
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_credit_check" CHECK ("credit" >= 0);

-- JournalLine: debit and credit cannot both be > 0
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_not_both_check" CHECK (NOT ("debit" > 0 AND "credit" > 0));

-- Stock quantities non-negative
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_current_stock_check" CHECK ("currentStock" >= 0);
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_min_level_check" CHECK ("minLevel" >= 0);
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_reorder_level_check" CHECK ("reorderLevel" >= 0);

ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_quantity_check" CHECK ("quantity" >= 0);

ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_ordered_qty_check" CHECK ("orderedQty" >= 0);
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_received_qty_check" CHECK ("receivedQty" >= 0);
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_rejected_qty_check" CHECK ("rejectedQty" >= 0);

ALTER TABLE "work_order_materials" ADD CONSTRAINT "work_order_materials_quantity_check" CHECK ("quantity" >= 0);

-- Commission ledger
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_rate_check" CHECK ("rate" >= 0);

-- Recovery
ALTER TABLE "recovery_assignments" ADD CONSTRAINT "recovery_assignments_percent_check" CHECK ("recoveryPercent" >= 0);

-- Payroll
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_earnings_check" CHECK ("earnings" >= 0);
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_deductions_check" CHECK ("deductions" >= 0);
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_loan_deduction_check" CHECK ("loanDeduction" >= 0);
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_tax_check" CHECK ("tax" >= 0);
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_net_pay_check" CHECK ("netPay" >= 0);

-- Loans
ALTER TABLE "loans" ADD CONSTRAINT "loans_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "loans" ADD CONSTRAINT "loans_installment_amount_check" CHECK ("installmentAmount" >= 0);
ALTER TABLE "loans" ADD CONSTRAINT "loans_remaining_balance_check" CHECK ("remainingBalance" >= 0);

-- BuyBack
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_deduction_percent_check" CHECK ("deductionPercent" >= 0);
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_settlement_amount_check" CHECK ("settlementAmount" >= 0);

-- Transfer
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_fee_check" CHECK ("transferFee" >= 0);

-- NOC
ALTER TABLE "noc_applications" ADD CONSTRAINT "noc_applications_fee_check" CHECK ("feeAmount" >= 0);

-- Possession
ALTER TABLE "possession_applications" ADD CONSTRAINT "possession_applications_charges_check" CHECK ("possessionCharges" >= 0);

-- Construction
ALTER TABLE "construction_applications" ADD CONSTRAINT "construction_applications_fees_check" CHECK ("fees" >= 0);

-- Work orders
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_labor_cost_check" CHECK ("laborCost" >= 0);
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_material_cost_check" CHECK ("materialCost" >= 0);

-- ══════════════════════════════════════════════════════════════
-- PARTIAL UNIQUE INDEXES (unique when not archived)
-- ══════════════════════════════════════════════════════════════

-- Dealer: membershipNumber unique when not archived
CREATE UNIQUE INDEX "dealers_membership_number_not_archived_idx" ON "dealers" ("membershipNumber") WHERE "archivedAt" IS NULL;

-- Vendor: name unique when not archived (if applicable)
-- Note: Vendor doesn't have archivedAt in current schema, skipping

-- ══════════════════════════════════════════════════════════════
-- JOURNAL BALANCE VERIFICATION (service-level enforcement)
-- ══════════════════════════════════════════════════════════════
-- NOTE: Enforce in service layer that sum(lines.debit) == sum(lines.credit)
-- per JournalEntry before posting. Use this verification query:
--
--   SELECT je.id, je."totalDebit", je."totalCredit",
--          SUM(jl.debit) AS sum_debit, SUM(jl.credit) AS sum_credit
--   FROM "journal_entries" je
--   JOIN "journal_entry_lines" jl ON jl."journalEntryId" = je.id
--   WHERE je.id = $1
--   GROUP BY je.id, je."totalDebit", je."totalCredit"
--   HAVING SUM(jl.debit) != SUM(jl.credit);
--
-- If this returns any rows, the journal entry is unbalanced and should not be posted.

-- ══════════════════════════════════════════════════════════════
-- ADDITIONAL INDEXES
-- ══════════════════════════════════════════════════════════════

-- Booking indexes
CREATE INDEX "bookings_dealer_id_idx" ON "bookings" ("dealerId");

-- Installment indexes
CREATE INDEX "installments_status_idx" ON "installments" ("status");
CREATE INDEX "installments_due_date_idx" ON "installments" ("dueDate");

-- Payment indexes
CREATE INDEX "payments_method_idx" ON "payments" ("method");
CREATE INDEX "payments_dealer_involved_idx" ON "payments" ("dealerInvolved");

-- Invoice indexes
CREATE INDEX "invoices_storage_bucket_idx" ON "invoices" ("storageBucket");

-- Expense indexes
CREATE INDEX "expenses_vendor_id_idx" ON "expenses" ("vendorId");

-- Journal entry indexes
CREATE INDEX "journal_entries_voucher_number_idx" ON "journal_entries" ("voucherNumber");
CREATE INDEX "journal_entries_status_idx" ON "journal_entries" ("status");

-- Employee indexes
CREATE INDEX "employees_department_id_idx" ON "employees" ("departmentId");
CREATE INDEX "employees_status_idx" ON "employees" ("status");

-- Attendance indexes
CREATE INDEX "attendance_status_idx" ON "attendance" ("status");

-- Leave request indexes
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" ("status");

-- Payroll indexes
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs" ("status");

-- Vendor indexes
CREATE INDEX "vendors_status_idx" ON "vendors" ("status");

-- Purchase request indexes
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests" ("status");

-- GRN indexes
CREATE INDEX "grns_inspection_status_idx" ON "grns" ("inspectionStatus");

-- Inventory indexes
CREATE INDEX "inventory_items_category_idx" ON "inventory_items" ("category");
CREATE INDEX "inventory_items_store_id_idx" ON "inventory_items" ("storeId");

-- Stock transaction indexes
CREATE INDEX "stock_transactions_type_idx" ON "stock_transactions" ("type");

-- Notice indexes
CREATE INDEX "notices_is_published_idx" ON "notices" ("isPublished");

-- Notification indexes
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications" ("userId", "isRead");

-- Complaint indexes
CREATE INDEX "complaints_assigned_staff_id_idx" ON "complaints" ("assignedStaffId");
CREATE INDEX "complaints_plot_id_idx" ON "complaints" ("plotId");

-- Work order indexes
CREATE INDEX "work_orders_assigned_staff_id_idx" ON "work_orders" ("assignedStaffId");
CREATE INDEX "work_orders_complaint_id_idx" ON "work_orders" ("complaintId");

-- Transfer indexes
CREATE INDEX "transfer_requests_plot_id_idx" ON "transfer_requests" ("plotId");
CREATE INDEX "transfer_requests_status_idx" ON "transfer_requests" ("status");

-- NOC indexes
CREATE INDEX "noc_applications_member_id_idx" ON "noc_applications" ("memberId");
CREATE INDEX "noc_applications_plot_id_idx" ON "noc_applications" ("plotId");

-- Possession indexes
CREATE INDEX "possession_applications_member_id_idx" ON "possession_applications" ("memberId");
CREATE INDEX "possession_applications_plot_id_idx" ON "possession_applications" ("plotId");

-- Construction indexes
CREATE INDEX "construction_applications_member_id_idx" ON "construction_applications" ("memberId");
CREATE INDEX "construction_applications_plot_id_idx" ON "construction_applications" ("plotId");

-- Plot merge indexes
CREATE INDEX "plot_merges_resulting_plot_id_idx" ON "plot_merges" ("resultingPlotId");

-- BuyBack indexes
CREATE INDEX "buybacks_plot_id_idx" ON "buybacks" ("plotId");
CREATE INDEX "buybacks_booking_id_idx" ON "buybacks" ("bookingId");

-- Registry indexes
CREATE INDEX "registry_batches_status_idx" ON "registry_batches" ("status");

-- Guard indexes
CREATE INDEX "guards_user_id_idx" ON "guards" ("userId");
CREATE INDEX "guards_status_idx" ON "guards" ("status");

-- Duty roster indexes
CREATE INDEX "duty_roster_guard_id_idx" ON "duty_roster" ("guardId");
CREATE INDEX "duty_roster_date_idx" ON "duty_roster" ("date");

-- Vehicle indexes
CREATE INDEX "vehicles_owner_member_id_idx" ON "vehicles" ("ownerMemberId");
CREATE INDEX "vehicles_status_idx" ON "vehicles" ("status");

-- Visitor entry indexes
CREATE INDEX "visitor_entries_host_member_id_idx" ON "visitor_entries" ("hostMemberId");
CREATE INDEX "visitor_entries_entry_time_idx" ON "visitor_entries" ("entryTime");

-- Pass indexes
CREATE INDEX "passes_related_member_id_idx" ON "passes" ("relatedMemberId");
CREATE INDEX "passes_status_idx" ON "passes" ("status");

-- Blacklist indexes
CREATE INDEX "blacklist_entries_cnic_idx" ON "blacklist_entries" ("cnic");
CREATE INDEX "blacklist_entries_vehicle_number_idx" ON "blacklist_entries" ("vehicleNumber");

-- Appointment indexes
CREATE INDEX "appointments_host_employee_id_idx" ON "appointments" ("hostEmployeeId");
CREATE INDEX "appointments_status_idx" ON "appointments" ("status");

-- Loan indexes
CREATE INDEX "loans_employee_id_idx" ON "loans" ("employeeId");
CREATE INDEX "loans_status_idx" ON "loans" ("status");

-- Recovery indexes
CREATE INDEX "recovery_assignments_booking_id_idx" ON "recovery_assignments" ("bookingId");
CREATE INDEX "recovery_assignments_agent_id_idx" ON "recovery_assignments" ("agentId");
CREATE INDEX "recovery_calls_assignment_id_idx" ON "recovery_calls" ("assignmentId");

-- Commission ledger indexes
CREATE INDEX "commission_ledger_dealer_id_idx" ON "commission_ledger" ("dealerId");
CREATE INDEX "commission_ledger_type_idx" ON "commission_ledger" ("type");

-- Account indexes
CREATE INDEX "accounts_type_idx" ON "accounts" ("type");
CREATE INDEX "accounts_parent_account_id_idx" ON "accounts" ("parentAccountId");

-- Store indexes
CREATE INDEX "stores_is_active_idx" ON "stores" ("isActive");

-- Quotation indexes
CREATE INDEX "quotations_purchase_request_id_idx" ON "quotations" ("purchaseRequestId");
CREATE INDEX "quotations_vendor_id_idx" ON "quotations" ("vendorId");
CREATE INDEX "quotations_status_idx" ON "quotations" ("status");

-- Purchase order indexes
CREATE INDEX "purchase_orders_purchase_request_id_idx" ON "purchase_orders" ("purchaseRequestId");
CREATE INDEX "purchase_orders_selected_vendor_id_idx" ON "purchase_orders" ("selectedVendorId");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" ("status");

-- GRN indexes
CREATE INDEX "grns_purchase_order_id_idx" ON "grns" ("purchaseOrderId");
CREATE INDEX "grns_vendor_id_idx" ON "grns" ("vendorId");

-- Payroll entry indexes
CREATE INDEX "payroll_entries_employee_id_idx" ON "payroll_entries" ("employeeId");

-- Employee salary component indexes
CREATE INDEX "employee_salary_components_employee_id_idx" ON "employee_salary_components" ("employeeId");

-- Tax slab indexes
CREATE INDEX "tax_slabs_min_income_idx" ON "tax_slabs" ("minIncome");

-- Notice target indexes
CREATE INDEX "notice_targets_notice_id_idx" ON "notice_targets" ("noticeId");
CREATE INDEX "notice_targets_role_id_idx" ON "notice_targets" ("roleId");
CREATE INDEX "notice_targets_member_id_idx" ON "notice_targets" ("memberId");

-- Document indexes
CREATE INDEX "documents_related_entity_type_entity_id_idx" ON "documents" ("relatedEntityType", "relatedEntityId");
CREATE INDEX "documents_verification_status_idx" ON "documents" ("verificationStatus");

-- Expense document indexes
CREATE INDEX "expense_documents_expense_id_idx" ON "expense_documents" ("expenseId");
CREATE INDEX "expense_documents_document_id_idx" ON "expense_documents" ("documentId");

-- Employee document indexes
CREATE INDEX "employee_documents_employee_id_idx" ON "employee_documents" ("employeeId");
CREATE INDEX "employee_documents_document_id_idx" ON "employee_documents" ("documentId");

-- Vendor document indexes
CREATE INDEX "vendor_documents_vendor_id_idx" ON "vendor_documents" ("vendorId");
CREATE INDEX "vendor_documents_document_id_idx" ON "vendor_documents" ("documentId");

-- Transfer document indexes
CREATE INDEX "transfer_documents_transfer_request_id_idx" ON "transfer_documents" ("transferRequestId");
CREATE INDEX "transfer_documents_document_id_idx" ON "transfer_documents" ("documentId");

-- Complaint attachment indexes
CREATE INDEX "complaint_attachments_complaint_id_idx" ON "complaint_attachments" ("complaintId");
CREATE INDEX "complaint_attachments_document_id_idx" ON "complaint_attachments" ("documentId");

-- Purchase request item indexes
CREATE INDEX "purchase_request_items_purchase_request_id_idx" ON "purchase_request_items" ("purchaseRequestId");

-- Purchase order item indexes
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items" ("purchaseOrderId");

-- Grn item indexes
CREATE INDEX "grn_items_grn_id_idx" ON "grn_items" ("grnId");

-- Work order progress indexes
CREATE INDEX "work_order_progress_work_order_id_idx" ON "work_order_progress" ("workOrderId");

-- Work order material indexes
CREATE INDEX "work_order_materials_work_order_id_idx" ON "work_order_materials" ("workOrderId");

-- Transfer approval stage indexes
CREATE INDEX "transfer_approval_stages_transfer_request_id_idx" ON "transfer_approval_stages" ("transferRequestId");

-- NOC approval stage indexes
CREATE INDEX "noc_approval_stages_noc_application_id_idx" ON "noc_approval_stages" ("nocApplicationId");

-- Possession approval stage indexes
CREATE INDEX "possession_approval_stages_possession_application_id_idx" ON "possession_approval_stages" ("possessionApplicationId");

-- Site inspection indexes
CREATE INDEX "site_inspections_application_id_idx" ON "site_inspections" ("applicationId");

-- Inspection violation indexes
CREATE INDEX "inspection_violations_inspection_id_idx" ON "inspection_violations" ("inspectionId");

-- Plot merge source indexes
CREATE INDEX "plot_merge_sources_plot_merge_id_idx" ON "plot_merge_sources" ("plotMergeId");
CREATE INDEX "plot_merge_sources_plot_id_idx" ON "plot_merge_sources" ("plotId");

-- Registry batch plot indexes
CREATE INDEX "registry_batch_plots_batch_id_idx" ON "registry_batch_plots" ("batchId");
CREATE INDEX "registry_batch_plots_plot_id_idx" ON "registry_batch_plots" ("plotId");

-- Complaint comment indexes
CREATE INDEX "complaint_comments_complaint_id_idx" ON "complaint_comments" ("complaintId");

-- Journal entry line indexes
CREATE INDEX "journal_entry_lines_journal_entry_id_idx" ON "journal_entry_lines" ("journalEntryId");
CREATE INDEX "journal_entry_lines_account_id_idx" ON "journal_entry_lines" ("accountId");

-- Payment allocation indexes
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations" ("paymentId");
CREATE INDEX "payment_allocations_installment_id_idx" ON "payment_allocations" ("installmentId");

-- Member nominee indexes
CREATE INDEX "member_nominees_member_id_idx" ON "member_nominees" ("memberId");

-- Ownership history indexes
CREATE INDEX "ownership_history_plot_id_idx" ON "ownership_history" ("plotId");
CREATE INDEX "ownership_history_member_id_idx" ON "ownership_history" ("memberId");

-- Installment plan indexes
CREATE INDEX "installment_plans_booking_id_idx" ON "installment_plans" ("bookingId");

-- Salary component def indexes
CREATE INDEX "salary_component_defs_type_idx" ON "salary_component_defs" ("type");

-- Statutory config indexes
CREATE INDEX "statutory_configs_key_idx" ON "statutory_configs" ("key");
