-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('Active', 'Inactive', 'Blacklisted');

-- CreateEnum
CREATE TYPE "PlotStatus" AS ENUM ('Available', 'Reserved', 'Booked', 'Allotted', 'Sold', 'Transferred', 'Cancelled', 'Possessed', 'UnderConstruction', 'Constructed', 'Merged', 'BoughtBack');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PendingApproval', 'Confirmed', 'Cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Completed', 'Reversed');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Paid');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('Active', 'Cancelled');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('Booking', 'Installment', 'Transfer', 'NOC', 'Possession', 'Construction', 'PlotMerge', 'BuyBack', 'Expense', 'OtherTransaction', 'VendorCommission');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Paid');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('Draft', 'PendingVerification', 'PendingApproval', 'Approved', 'Rejected', 'Completed');

-- CreateEnum
CREATE TYPE "ConstructionStatus" AS ENUM ('Applied', 'UnderReview', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "NocStatus" AS ENUM ('Applied', 'UnderVerification', 'DuesPending', 'Approved', 'Issued', 'Rejected');

-- CreateEnum
CREATE TYPE "PossessionStatus" AS ENUM ('Applied', 'UnderVerification', 'Approved', 'Possessed');

-- CreateEnum
CREATE TYPE "BuyBackStatus" AS ENUM ('Pending', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "BuyBackType" AS ENUM ('BuyBack', 'Cancel');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('New', 'Assigned', 'InProgress', 'Resolved', 'Reopened', 'Closed');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('Low', 'Medium', 'High', 'Urgent');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('Open', 'InProgress', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('road', 'light', 'park', 'water', 'sewerage', 'drainage', 'building', 'other');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('Car', 'Bike', 'Van', 'Truck', 'SUV', 'Other');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('Active', 'Blocked', 'Expired');

-- CreateEnum
CREATE TYPE "PassType" AS ENUM ('Visitor', 'Staff', 'Contractor');

-- CreateEnum
CREATE TYPE "PassStatus" AS ENUM ('Active', 'Expired', 'Cancelled');

-- CreateEnum
CREATE TYPE "BlacklistAction" AS ENUM ('Warn', 'Block');

-- CreateEnum
CREATE TYPE "GuardShift" AS ENUM ('Morning', 'Evening', 'Night');

-- CreateEnum
CREATE TYPE "GuardStatus" AS ENUM ('Active', 'Inactive', 'Suspended');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('Present', 'Absent', 'Leave');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('Waiting', 'InMeeting', 'Done');

-- CreateEnum
CREATE TYPE "RecoveryStatus" AS ENUM ('Assigned', 'InProgress', 'Resolved', 'Reassigned');

-- CreateEnum
CREATE TYPE "RecoveryOutcome" AS ENUM ('Connected', 'NoAnswer', 'PromiseToPay', 'Paid', 'Escalated', 'WrongNumber', 'Other');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('Draft', 'Approved', 'Paid');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('Active', 'Closed');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('Annual', 'Sick', 'Casual', 'Unpaid', 'Maternity', 'Paternity');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Cancelled');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('Active', 'OnLeave', 'Resigned', 'Terminated');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('Pending', 'Verified', 'Rejected');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('Active', 'Inactive', 'Blacklisted');

-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('Construction', 'Electrical', 'Plumbing', 'Security', 'Cleaning', 'IT', 'Stationery', 'General');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Cancelled', 'Completed');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('Submitted', 'Selected', 'Rejected', 'Expired');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('Draft', 'Approved', 'Sent', 'PartiallyReceived', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "GrnInspectionStatus" AS ENUM ('Passed', 'PartiallyPassed', 'Failed');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'approve', 'reject', 'cancel', 'statusChange', 'login', 'logout');

-- CreateEnum
CREATE TYPE "NumberingResetPolicy" AS ENUM ('never', 'daily', 'yearly', 'monthly');

-- CreateEnum
CREATE TYPE "SalaryComponentType" AS ENUM ('Earning', 'Deduction');

-- CreateEnum
CREATE TYPE "SalaryComponentCalculationType" AS ENUM ('Fixed', 'Percentage');

-- CreateEnum
CREATE TYPE "DealerStatus" AS ENUM ('Active', 'Inactive', 'Suspended', 'Blacklisted');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('Percentage', 'Flat');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Cash', 'BankTransfer', 'Cheque', 'Online', 'Challan');

-- CreateEnum
CREATE TYPE "CommissionLedgerType" AS ENUM ('Accrual', 'Override', 'Payout', 'Reversal');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('Payment', 'Refund', 'Expense', 'Payroll', 'Transfer', 'Adjustment', 'OpeningBalance');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('Draft', 'Posted', 'Reversed');
