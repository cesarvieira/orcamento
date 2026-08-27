DROP INDEX "convites_token_unico";--> statement-breakpoint
DROP INDEX "identidades_token_confirmacao_unico";--> statement-breakpoint
ALTER TABLE "convites" ADD COLUMN "tentativas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "identidades" ADD COLUMN "tentativas_confirmacao" integer DEFAULT 0 NOT NULL;