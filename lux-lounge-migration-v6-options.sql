-- Lux Lounge OS — Migration V6
-- Grupos de Opções de Produto (adicionais, variações)
-- Segura para re-execução (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────
-- 1. Grupos de opções por produto
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_option_groups (
  id          serial      PRIMARY KEY,
  product_id  integer     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  nome        text        NOT NULL,
  tipo        text        NOT NULL DEFAULT 'single' CHECK (tipo IN ('single', 'multiple')),
  obrigatorio boolean     NOT NULL DEFAULT false,
  min_select  integer     NOT NULL DEFAULT 0,
  max_select  integer     NOT NULL DEFAULT 1,
  ordem       integer     NOT NULL DEFAULT 0,
  ativo       boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_option_groups_product_id
  ON product_option_groups(product_id);

-- ─────────────────────────────────────────
-- 2. Opções dentro de cada grupo
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_options (
  id          serial      PRIMARY KEY,
  group_id    integer     NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  nome        text        NOT NULL,
  price_delta numeric     NOT NULL DEFAULT 0,
  ordem       integer     NOT NULL DEFAULT 0,
  ativo       boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_options_group_id
  ON product_options(group_id);

-- ─────────────────────────────────────────
-- 3. Colunas em pedido_itens
--    selected_options: snapshot das opções escolhidas (JSONB)
--    price_additions:  soma dos price_delta por unidade
-- ─────────────────────────────────────────
ALTER TABLE pedido_itens
  ADD COLUMN IF NOT EXISTS selected_options jsonb    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_additions  numeric  NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────
-- 4. RLS nas novas tabelas
-- ─────────────────────────────────────────
ALTER TABLE product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "option_groups_read"  ON product_option_groups;
DROP POLICY IF EXISTS "option_groups_write" ON product_option_groups;
DROP POLICY IF EXISTS "options_read"        ON product_options;
DROP POLICY IF EXISTS "options_write"       ON product_options;

CREATE POLICY "option_groups_read"
  ON product_option_groups FOR SELECT
  USING (true);

CREATE POLICY "option_groups_write"
  ON product_option_groups FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "options_read"
  ON product_options FOR SELECT
  USING (true);

CREATE POLICY "options_write"
  ON product_options FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
