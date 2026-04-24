-- CreateTable
CREATE TABLE "Hero" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "originalName" TEXT NOT NULL,
    "superheroName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "nameMeaning" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Hero_originalName_key" ON "Hero"("originalName");
