CREATE TYPE "public"."status_fatura" AS ENUM('ABERTA', 'FECHADA', 'PAGA');--> statement-breakpoint
CREATE TABLE "faturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"conta_id" uuid NOT NULL,
	"abre_em" date NOT NULL,
	"fecha_em" date NOT NULL,
	"vence_em" date NOT NULL,
	"status" "status_fatura" DEFAULT 'ABERTA' NOT NULL,
	"paga_em" timestamp with time zone,
	"paga_com_conta_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faturas_pagamento_completo_ou_ausente" CHECK (("faturas"."status" = 'PAGA' and "faturas"."paga_em" is not null and "faturas"."paga_com_conta_id" is not null)
          or ("faturas"."status" <> 'PAGA' and "faturas"."paga_em" is null and "faturas"."paga_com_conta_id" is null))
);
--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_conta_id_contas_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_paga_com_conta_id_contas_id_fk" FOREIGN KEY ("paga_com_conta_id") REFERENCES "public"."contas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "faturas_conta_fecha_em_unico" ON "faturas" USING btree ("conta_id","fecha_em");--> statement-breakpoint
CREATE INDEX "faturas_por_familia" ON "faturas" USING btree ("familia_id");--> statement-breakpoint
CREATE INDEX "faturas_por_conta" ON "faturas" USING btree ("conta_id");