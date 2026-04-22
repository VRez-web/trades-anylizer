CREATE TABLE "label_defs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merge_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"period_key" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"trade_plan" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_doc" (
	"id" integer PRIMARY KEY NOT NULL,
	"markdown" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_label_links" (
	"trade_id" integer NOT NULL,
	"label_id" integer NOT NULL,
	CONSTRAINT "trade_label_links_trade_id_label_id_pk" PRIMARY KEY("trade_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_key" text,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"entry_reason_id" integer,
	"exit_reason_id" integer,
	"entry_at" timestamp with time zone NOT NULL,
	"exit_at" timestamp with time zone NOT NULL,
	"leverage" double precision NOT NULL,
	"entry_price" double precision NOT NULL,
	"exit_price" double precision NOT NULL,
	"income" double precision NOT NULL,
	"commission" double precision NOT NULL,
	"funding" double precision NOT NULL,
	"entry_notional_usdt" double precision,
	"rr" double precision,
	"note_system" text,
	"note_technique" text,
	"note_analysis" text,
	"note_system_ts" text,
	"note_technique_ts" text,
	"note_analysis_ts" text,
	"merge_group_id" integer,
	"merged_from" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_label_links" ADD CONSTRAINT "trade_label_links_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_label_links" ADD CONSTRAINT "trade_label_links_label_id_label_defs_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_entry_reason_id_reasons_id_fk" FOREIGN KEY ("entry_reason_id") REFERENCES "public"."reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_exit_reason_id_reasons_id_fk" FOREIGN KEY ("exit_reason_id") REFERENCES "public"."reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_merge_group_id_merge_groups_id_fk" FOREIGN KEY ("merge_group_id") REFERENCES "public"."merge_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "label_defs_kind_label" ON "label_defs" USING btree ("kind","label");--> statement-breakpoint
CREATE UNIQUE INDEX "period_notes_scope_key" ON "period_notes" USING btree ("scope","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "trades_external_key_unique" ON "trades" USING btree ("external_key");