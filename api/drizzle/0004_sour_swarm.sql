CREATE TYPE "public"."tipo_conta" AS ENUM('DEBITO', 'CREDITO', 'RESERVA');--> statement-breakpoint
CREATE TABLE "contas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"tipo" "tipo_conta" NOT NULL,
	"nome" text NOT NULL,
	"icone" text NOT NULL,
	"cor" text NOT NULL,
	"saldo_inicial_centavos" integer,
	"limite_centavos" integer,
	"dia_fechamento" integer,
	"dia_vencimento" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contas_dia_fechamento_intervalo" CHECK ("contas"."dia_fechamento" is null or ("contas"."dia_fechamento" between 1 and 28)),
	CONSTRAINT "contas_dia_vencimento_intervalo" CHECK ("contas"."dia_vencimento" is null or ("contas"."dia_vencimento" between 1 and 28)),
	CONSTRAINT "contas_campos_de_credito_apenas_em_credito" CHECK ("contas"."tipo" = 'CREDITO' or ("contas"."limite_centavos" is null and "contas"."dia_fechamento" is null and "contas"."dia_vencimento" is null)),
	CONSTRAINT "contas_saldo_inicial_nao_em_credito" CHECK ("contas"."tipo" <> 'CREDITO' or "contas"."saldo_inicial_centavos" is null)
);
--> statement-breakpoint
ALTER TABLE "contas" ADD CONSTRAINT "contas_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contas_por_familia" ON "contas" USING btree ("familia_id");