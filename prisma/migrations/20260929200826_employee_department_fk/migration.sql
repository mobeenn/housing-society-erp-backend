-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "salaryStructure" JSONB;

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
