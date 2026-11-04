-- Adiciona campo centro_lucro na tabela areas_empresas
ALTER TABLE areas_empresas ADD COLUMN IF NOT EXISTS centro_lucro text;
