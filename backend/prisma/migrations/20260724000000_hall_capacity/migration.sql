-- AlterTable
-- Nullable sutun, DEFAULT yok - mevcut satirlar etkilenmez, hepsi NULL kalir
-- (veri kaybi riski yok, hicbir tahmini/sahte deger yazilmaz).
ALTER TABLE `Hall` ADD COLUMN `capacity` INTEGER NULL;
