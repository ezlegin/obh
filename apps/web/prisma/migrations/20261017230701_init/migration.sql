-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('PROVIDER', 'BUSINESS');

-- CreateEnum
CREATE TYPE "ProviderEnvironment" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentEventSource" AS ENUM ('SYSTEM', 'SERVICE', 'PROVIDER', 'MANAGER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransferKind" AS ENUM ('INTERNAL', 'SETTLEMENT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeeKind" AS ENUM ('GATEWAY_FEE', 'COMMISSION');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('PENDING', 'SETTLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'EXHAUSTED');

-- CreateEnum
CREATE TYPE "ProfitPeriodStatus" AS ENUM ('DRAFT', 'APPROVED', 'CLOSED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ProfitDistributionStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "passwordHash" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedService" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "allowedReturnUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ConnectedService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCredential" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "keyId" VARCHAR(64) NOT NULL,
    "secretHash" VARCHAR(255) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ServiceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProvider" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "providerId" UUID,
    "environment" "ProviderEnvironment",
    "externalReference" VARCHAR(191),
    "institution" VARCHAR(160),
    "maskedIdentifier" VARCHAR(80),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "openingBalance" DECIMAL(24,2) NOT NULL DEFAULT 0,
    "openingBalanceAt" TIMESTAMPTZ(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountReconciliation" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "asOf" TIMESTAMPTZ(3) NOT NULL,
    "actualBalance" DECIMAL(24,2) NOT NULL,
    "calculatedBalance" DECIMAL(24,2) NOT NULL,
    "difference" DECIMAL(24,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(48) NOT NULL,
    "serviceId" UUID,
    "externalOrderId" VARCHAR(191),
    "idempotencyKey" VARCHAR(191),
    "amount" DECIMAL(24,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "direction" "PaymentDirection" NOT NULL DEFAULT 'INCOMING',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "providerId" UUID,
    "providerAccountId" UUID,
    "providerReference" VARCHAR(191),
    "providerSessionId" VARCHAR(191),
    "checkoutUrl" TEXT,
    "paymentMethodId" UUID,
    "completedAt" TIMESTAMPTZ(3),
    "verifiedAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "source" "PaymentEventSource" NOT NULL,
    "previousStatus" "PaymentStatus",
    "newStatus" "PaymentStatus",
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentVerification" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "method" VARCHAR(80) NOT NULL,
    "providerReference" VARCHAR(191),
    "verifiedAt" TIMESTAMPTZ(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderFee" (
    "id" UUID NOT NULL,
    "providerAccountId" UUID NOT NULL,
    "paymentId" UUID,
    "kind" "FeeKind" NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(24,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "chargedAt" TIMESTAMPTZ(3) NOT NULL,
    "reference" VARCHAR(191),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProviderFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(48) NOT NULL,
    "fromAccountId" UUID NOT NULL,
    "toAccountId" UUID NOT NULL,
    "amount" DECIMAL(24,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "kind" "TransferKind" NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "externalReference" VARCHAR(191),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "lastAttemptAt" TIMESTAMPTZ(3),
    "nextAttemptAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "accountId" UUID,
    "amount" DECIMAL(24,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "spentOn" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMPTZ(3),
    "externalReference" VARCHAR(191),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseDocument" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "mimeType" VARCHAR(160) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksumSha256" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" UUID NOT NULL,
    "accountId" UUID,
    "amount" DECIMAL(24,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "receivedOn" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "source" VARCHAR(160),
    "externalReference" VARCHAR(191),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shareholder" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Shareholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipRecord" (
    "id" UUID NOT NULL,
    "shareholderId" UUID NOT NULL,
    "percentage" DECIMAL(7,4) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OwnershipRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalContribution" (
    "id" UUID NOT NULL,
    "shareholderId" UUID NOT NULL,
    "accountId" UUID,
    "amount" DECIMAL(24,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "contributedOn" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "externalReference" VARCHAR(191),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CapitalContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitPeriod" (
    "id" UUID NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "status" "ProfitPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "totalRevenue" DECIMAL(24,2),
    "totalExpenses" DECIMAL(24,2),
    "netProfit" DECIMAL(24,2),
    "distributableAmount" DECIMAL(24,2),
    "calculatedAt" TIMESTAMPTZ(3),
    "approvedAt" TIMESTAMPTZ(3),
    "approvedById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProfitPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitDistribution" (
    "id" UUID NOT NULL,
    "profitPeriodId" UUID NOT NULL,
    "shareholderId" UUID NOT NULL,
    "percentageSnapshot" DECIMAL(7,4) NOT NULL,
    "allocatedAmount" DECIMAL(24,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "status" "ProfitDistributionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMPTZ(3),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProfitDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareholderPayout" (
    "id" UUID NOT NULL,
    "profitDistributionId" UUID NOT NULL,
    "accountId" UUID,
    "amount" DECIMAL(24,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMPTZ(3),
    "externalReference" VARCHAR(191),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ShareholderPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(80) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedService_slug_key" ON "ConnectedService"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedService_domain_key" ON "ConnectedService"("domain");

-- CreateIndex
CREATE INDEX "ConnectedService_isActive_idx" ON "ConnectedService"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCredential_keyId_key" ON "ServiceCredential"("keyId");

-- CreateIndex
CREATE INDEX "ServiceCredential_serviceId_revokedAt_idx" ON "ServiceCredential"("serviceId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_code_key" ON "PaymentProvider"("code");

-- CreateIndex
CREATE INDEX "PaymentProvider_isActive_idx" ON "PaymentProvider"("isActive");

-- CreateIndex
CREATE INDEX "FinancialAccount_kind_isActive_idx" ON "FinancialAccount"("kind", "isActive");

-- CreateIndex
CREATE INDEX "FinancialAccount_providerId_idx" ON "FinancialAccount"("providerId");

-- CreateIndex
CREATE INDEX "AccountReconciliation_accountId_asOf_idx" ON "AccountReconciliation"("accountId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_code_key" ON "PaymentMethod"("code");

-- CreateIndex
CREATE INDEX "PaymentMethod_isActive_idx" ON "PaymentMethod"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_serviceId_createdAt_idx" ON "Payment"("serviceId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_providerAccountId_createdAt_idx" ON "Payment"("providerAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_providerReference_idx" ON "Payment"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_serviceId_externalOrderId_key" ON "Payment"("serviceId", "externalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_serviceId_idempotencyKey_key" ON "Payment"("serviceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_createdAt_idx" ON "PaymentEvent"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_type_createdAt_idx" ON "PaymentEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentVerification_paymentId_createdAt_idx" ON "PaymentVerification"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentVerification_status_createdAt_idx" ON "PaymentVerification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderFee_providerAccountId_chargedAt_idx" ON "ProviderFee"("providerAccountId", "chargedAt");

-- CreateIndex
CREATE INDEX "ProviderFee_paymentId_idx" ON "ProviderFee"("paymentId");

-- CreateIndex
CREATE INDEX "ProviderFee_status_chargedAt_idx" ON "ProviderFee"("status", "chargedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_reference_key" ON "Transfer"("reference");

-- CreateIndex
CREATE INDEX "Transfer_fromAccountId_occurredAt_idx" ON "Transfer"("fromAccountId", "occurredAt");

-- CreateIndex
CREATE INDEX "Transfer_toAccountId_occurredAt_idx" ON "Transfer"("toAccountId", "occurredAt");

-- CreateIndex
CREATE INDEX "Transfer_status_occurredAt_idx" ON "Transfer"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_serviceId_createdAt_idx" ON "WebhookDelivery"("serviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_paymentId_eventType_key" ON "WebhookDelivery"("paymentId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "ExpenseCategory_isActive_sortOrder_idx" ON "ExpenseCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Expense_spentOn_idx" ON "Expense"("spentOn");

-- CreateIndex
CREATE INDEX "Expense_categoryId_spentOn_idx" ON "Expense"("categoryId", "spentOn");

-- CreateIndex
CREATE INDEX "Expense_accountId_spentOn_idx" ON "Expense"("accountId", "spentOn");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseDocument_storageKey_key" ON "ExpenseDocument"("storageKey");

-- CreateIndex
CREATE INDEX "ExpenseDocument_expenseId_idx" ON "ExpenseDocument"("expenseId");

-- CreateIndex
CREATE INDEX "Income_receivedOn_idx" ON "Income"("receivedOn");

-- CreateIndex
CREATE INDEX "Income_accountId_receivedOn_idx" ON "Income"("accountId", "receivedOn");

-- CreateIndex
CREATE INDEX "Shareholder_isActive_idx" ON "Shareholder"("isActive");

-- CreateIndex
CREATE INDEX "OwnershipRecord_shareholderId_effectiveFrom_idx" ON "OwnershipRecord"("shareholderId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "OwnershipRecord_effectiveFrom_effectiveTo_idx" ON "OwnershipRecord"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "CapitalContribution_shareholderId_contributedOn_idx" ON "CapitalContribution"("shareholderId", "contributedOn");

-- CreateIndex
CREATE INDEX "CapitalContribution_accountId_contributedOn_idx" ON "CapitalContribution"("accountId", "contributedOn");

-- CreateIndex
CREATE INDEX "ProfitPeriod_status_endsOn_idx" ON "ProfitPeriod"("status", "endsOn");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitPeriod_startsOn_endsOn_key" ON "ProfitPeriod"("startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "ProfitDistribution_shareholderId_createdAt_idx" ON "ProfitDistribution"("shareholderId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfitDistribution_status_idx" ON "ProfitDistribution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitDistribution_profitPeriodId_shareholderId_key" ON "ProfitDistribution"("profitPeriodId", "shareholderId");

-- CreateIndex
CREATE INDEX "ShareholderPayout_profitDistributionId_createdAt_idx" ON "ShareholderPayout"("profitDistributionId", "createdAt");

-- CreateIndex
CREATE INDEX "ShareholderPayout_accountId_paidAt_idx" ON "ShareholderPayout"("accountId", "paidAt");

-- CreateIndex
CREATE INDEX "ShareholderPayout_status_idx" ON "ShareholderPayout"("status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ServiceCredential" ADD CONSTRAINT "ServiceCredential_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ConnectedService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "PaymentProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountReconciliation" ADD CONSTRAINT "AccountReconciliation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ConnectedService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "PaymentProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVerification" ADD CONSTRAINT "PaymentVerification_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderFee" ADD CONSTRAINT "ProviderFee_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderFee" ADD CONSTRAINT "ProviderFee_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ConnectedService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseDocument" ADD CONSTRAINT "ExpenseDocument_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipRecord" ADD CONSTRAINT "OwnershipRecord_shareholderId_fkey" FOREIGN KEY ("shareholderId") REFERENCES "Shareholder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalContribution" ADD CONSTRAINT "CapitalContribution_shareholderId_fkey" FOREIGN KEY ("shareholderId") REFERENCES "Shareholder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalContribution" ADD CONSTRAINT "CapitalContribution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitPeriod" ADD CONSTRAINT "ProfitPeriod_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitDistribution" ADD CONSTRAINT "ProfitDistribution_profitPeriodId_fkey" FOREIGN KEY ("profitPeriodId") REFERENCES "ProfitPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitDistribution" ADD CONSTRAINT "ProfitDistribution_shareholderId_fkey" FOREIGN KEY ("shareholderId") REFERENCES "Shareholder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareholderPayout" ADD CONSTRAINT "ShareholderPayout_profitDistributionId_fkey" FOREIGN KEY ("profitDistributionId") REFERENCES "ProfitDistribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareholderPayout" ADD CONSTRAINT "ShareholderPayout_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
