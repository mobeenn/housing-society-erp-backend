-- Additive: allow retiring roles without deleting them (Store Manager / Procurement Officer merge).
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
