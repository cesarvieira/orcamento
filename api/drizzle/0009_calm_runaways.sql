CREATE TABLE "fechamentos_mes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"competencia" char(7) NOT NULL,
	"sobra_centavos" integer NOT NULL,
	"fechado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"autor_membro_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fechamentos_mes" ADD CONSTRAINT "fechamentos_mes_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fechamentos_mes" ADD CONSTRAINT "fechamentos_mes_autor_membro_id_membros_id_fk" FOREIGN KEY ("autor_membro_id") REFERENCES "public"."membros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fechamentos_mes_familia_competencia_unico" ON "fechamentos_mes" USING btree ("familia_id","competencia");