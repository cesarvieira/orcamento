ALTER TABLE "convites" ADD COLUMN "recusado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identidades" ADD COLUMN "token_confirmacao" text;--> statement-breakpoint
ALTER TABLE "identidades" ADD COLUMN "confirmacao_expira_em" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "convites_por_email" ON "convites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "identidades_token_confirmacao_unico" ON "identidades" USING btree ("token_confirmacao");