-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "companyId" TEXT,
    "brandId" TEXT,
    "countryId" TEXT,
    "currentVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "definitionJson" TEXT NOT NULL,
    "changeNote" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "retiredAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "companyId" TEXT,
    "brandId" TEXT,
    "countryId" TEXT,
    "dataJson" TEXT,
    "dueAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "startedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransitionLog" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "transitionKey" TEXT,
    "actorId" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTransitionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_key_key" ON "WorkflowDefinition"("key");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_module_idx" ON "WorkflowDefinition"("module");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_status_idx" ON "WorkflowDefinition"("status");

-- CreateIndex
CREATE INDEX "WorkflowVersion_definitionId_idx" ON "WorkflowVersion"("definitionId");

-- CreateIndex
CREATE INDEX "WorkflowVersion_status_idx" ON "WorkflowVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_definitionId_version_key" ON "WorkflowVersion"("definitionId", "version");

-- CreateIndex
CREATE INDEX "WorkflowInstance_definitionId_idx" ON "WorkflowInstance"("definitionId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_status_dueAt_idx" ON "WorkflowInstance"("status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkflowInstance_currentStage_idx" ON "WorkflowInstance"("currentStage");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_entityType_entityId_key" ON "WorkflowInstance"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "WorkflowTransitionLog_instanceId_idx" ON "WorkflowTransitionLog"("instanceId");

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransitionLog" ADD CONSTRAINT "WorkflowTransitionLog_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
