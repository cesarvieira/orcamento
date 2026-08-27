CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"icone" text NOT NULL,
	"cor" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"competencia" char(7) NOT NULL,
	"renda_prevista_centavos" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orcamentos_mes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"competencia" char(7) NOT NULL,
	"teto_centavos" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remanejamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"competencia" char(7) NOT NULL,
	"categoria_origem_id" uuid NOT NULL,
	"categoria_destino_id" uuid NOT NULL,
	"valor_centavos" integer NOT NULL,
	"autor_membro_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remanejamentos_valor_positivo" CHECK ("remanejamentos"."valor_centavos" > 0),
	CONSTRAINT "remanejamentos_origem_diferente_destino" CHECK ("remanejamentos"."categoria_origem_id" <> "remanejamentos"."categoria_destino_id")
);
--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencias" ADD CONSTRAINT "competencias_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamentos_mes" ADD CONSTRAINT "orcamentos_mes_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamentos_mes" ADD CONSTRAINT "orcamentos_mes_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remanejamentos" ADD CONSTRAINT "remanejamentos_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remanejamentos" ADD CONSTRAINT "remanejamentos_categoria_origem_id_categorias_id_fk" FOREIGN KEY ("categoria_origem_id") REFERENCES "public"."categorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remanejamentos" ADD CONSTRAINT "remanejamentos_categoria_destino_id_categorias_id_fk" FOREIGN KEY ("categoria_destino_id") REFERENCES "public"."categorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remanejamentos" ADD CONSTRAINT "remanejamentos_autor_membro_id_membros_id_fk" FOREIGN KEY ("autor_membro_id") REFERENCES "public"."membros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categorias_por_familia" ON "categorias" USING btree ("familia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competencias_familia_competencia_unico" ON "competencias" USING btree ("familia_id","competencia");--> statement-breakpoint
CREATE UNIQUE INDEX "orcamentos_mes_categoria_competencia_unico" ON "orcamentos_mes" USING btree ("categoria_id","competencia");--> statement-breakpoint
CREATE INDEX "orcamentos_mes_por_familia_competencia" ON "orcamentos_mes" USING btree ("familia_id","competencia");--> statement-breakpoint
CREATE INDEX "remanejamentos_por_familia_competencia" ON "remanejamentos" USING btree ("familia_id","competencia");