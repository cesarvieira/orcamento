ALTER TABLE "identidades" ADD COLUMN "token_recuperacao" text;--> statement-breakpoint
ALTER TABLE "identidades" ADD COLUMN "recuperacao_expira_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identidades" ADD COLUMN "tentativas_recuperacao" integer DEFAULT 0 NOT NULL;