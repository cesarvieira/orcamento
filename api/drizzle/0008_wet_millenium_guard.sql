CREATE TABLE "metas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"alvo_centavos" integer NOT NULL,
	"conta_reserva_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metas_alvo_positivo" CHECK ("metas"."alvo_centavos" > 0)
);
--> statement-breakpoint
ALTER TABLE "metas" ADD CONSTRAINT "metas_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metas" ADD CONSTRAINT "metas_conta_reserva_id_contas_id_fk" FOREIGN KEY ("conta_reserva_id") REFERENCES "public"."contas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "metas_por_familia" ON "metas" USING btree ("familia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metas_conta_reserva_unica" ON "metas" USING btree ("conta_reserva_id");