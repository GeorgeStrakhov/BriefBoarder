import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const briefs = pgTable("briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  canvasState: jsonb("canvas_state").$type<{
    images: Array<{
      id: string;
      s3Url: string;
      s3Key: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
    }>;
  }>(),
  settings: jsonb("settings").$type<{
    imageGenerationModel?: string;
    imageEditingModel?: string;
    imageUpscalingModel?: string;
    defaultAspectRatio?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
