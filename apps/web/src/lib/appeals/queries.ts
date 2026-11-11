import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppealTarget } from "@/lib/validation/appeal-rules";

export type Decision = {
  target_type: AppealTarget;
  target_id: string;
  label: string;
  reason: string | null;
  decided_at: string | null;
  copyright: boolean;
  appeal_id: string | null;
  appeal_status: "open" | "upheld" | "overturned" | null;
};

export type MyAppeal = {
  id: string;
  kind: "appeal" | "counter_notice";
  target_type: AppealTarget;
  target_label: string;
  decision_reason: string | null;
  message: string;
  status: "open" | "upheld" | "overturned";
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

const MY_APPEALS_LIMIT = 50;

/** What is decided about the signed-in person right now (their suspension and what of theirs is hidden), and which of it they already appealed. */
export async function listMyDecisions(): Promise<Decision[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_decisions");
  return (data ?? []) as Decision[];
}

/** The signed-in person's appeals, newest first, with the answer when there is one (the database only shows them their own). */
export async function listMyAppeals(): Promise<MyAppeal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appeals")
    .select("id, kind, target_type, target_label, decision_reason, message, status, resolution_note, resolved_at, created_at")
    .order("created_at", { ascending: false })
    .limit(MY_APPEALS_LIMIT);
  return (data ?? []) as MyAppeal[];
}
