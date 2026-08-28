CREATE TYPE "public"."tipo_lancamento" AS ENUM('RECEITA', 'DESPESA', 'TRANSFERENCIA');--> statement-breakpoint
CREATE TABLE "lancamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"tipo" "tipo_lancamento" NOT NULL,
	"descricao" text NOT NULL,
	"valor_centavos" integer NOT NULL,
	"data" date NOT NULL,
	"competencia" char(7) NOT NULL,
	"categoria_id" uuid,
	"conta_id" uuid NOT NULL,
	"conta_destino_id" uuid,
	"criado_por_membro_id" uuid NOT NULL,
	"serie_parcela_id" uuid,
	"numero_parcela" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lancamentos_valor_positivo" CHECK ("lancamentos"."valor_centavos" > 0),
	CONSTRAINT "lancamentos_categoria_somente_em_despesa" CHECK (("lancamentos"."tipo" = 'DESPESA' and "lancamentos"."categoria_id" is not null) or ("lancamentos"."tipo" <> 'DESPESA' and "lancamentos"."categoria_id" is null)),
	CONSTRAINT "lancamentos_conta_destino_somente_em_transferencia" CHECK (("lancamentos"."tipo" = 'TRANSFERENCIA' and "lancamentos"."conta_destino_id" is not null) or ("lancamentos"."tipo" <> 'TRANSFERENCIA' and "lancamentos"."conta_destino_id" is null)),
	CONSTRAINT "lancamentos_conta_destino_diferente_da_origem" CHECK ("lancamentos"."conta_destino_id" is null or "lancamentos"."conta_destino_id" <> "lancamentos"."conta_id")
);
--> statement-breakpoint
CREATE TABLE "series_parcelas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"total_centavos" integer NOT NULL,
	"quantidade" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_parcelas_total_positivo" CHECK ("series_parcelas"."total_centavos" > 0),
	CONSTRAINT "series_parcelas_quantidade_intervalo" CHECK ("series_parcelas"."quantidade" between 2 and 48)
);
--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_conta_id_contas_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_conta_destino_id_contas_id_fk" FOREIGN KEY ("conta_destino_id") REFERENCES "public"."contas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_criado_por_membro_id_membros_id_fk" FOREIGN KEY ("criado_por_membro_id") REFERENCES "public"."membros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_serie_parcela_id_series_parcelas_id_fk" FOREIGN KEY ("serie_parcela_id") REFERENCES "public"."series_parcelas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_parcelas" ADD CONSTRAINT "series_parcelas_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancamentos_por_familia_competencia" ON "lancamentos" USING btree ("familia_id","competencia");--> statement-breakpoint
CREATE INDEX "lancamentos_por_conta" ON "lancamentos" USING btree ("conta_id");--> statement-breakpoint
CREATE INDEX "lancamentos_por_categoria_competencia" ON "lancamentos" USING btree ("categoria_id","competencia");--> statement-breakpoint
CREATE INDEX "lancamentos_por_serie" ON "lancamentos" USING btree ("serie_parcela_id");--> statement-breakpoint
CREATE INDEX "series_parcelas_por_familia" ON "series_parcelas" USING btree ("familia_id");