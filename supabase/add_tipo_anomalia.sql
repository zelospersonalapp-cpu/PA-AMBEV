-- Adiciona a coluna tipo_anomalia na tabela avarias
ALTER TABLE avarias ADD COLUMN IF NOT EXISTS tipo_anomalia text;
