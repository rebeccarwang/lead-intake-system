import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_SOURCES = ["Google", "Referral", "Social", "Other"];

const WEBHOOK_URL = process.env.WEBHOOK_URL;

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const TIMEOUT_MS = 10_000;

type LeadInput = {
  full_name: string;
  email: string;
  company?: string | null;
  source: string;
  message?: string | null;
};


function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are not configured for anon");
  }
  return createClient(url, anonKey);
}


function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !adminKey) {
    throw new Error("Supabase environment variables are not configured for admin");
  }
  return createClient(url, adminKey);
}


// validates form input from app/page.tsx
function validate(body: unknown): { ok: true; data: LeadInput } | { ok: false; error: string } {

  // checks whether input is object, checks full_name exists, validates email, and checks source is valid
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;

  const full_name = typeof b.full_name === "string" ? b.full_name.trim() : "";
  if (!full_name) {
    return { ok: false, error: "A full name is required." };
  }

  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!email || !EMAIL_REGEX.test(email)) {
    return { ok: false, error: "A valid email is required." };
  }

  const source = typeof b.source === "string" ? b.source.trim() : "";
  if (!ALLOWED_SOURCES.includes(source)) {
    return {
      ok: false,
      error: `source must be one of: ${ALLOWED_SOURCES.join(", ")}`,
    };
  }

  // company and message are optional
  const company =
    typeof b.company === "string" && b.company.trim() ? b.company.trim() : null;
  const message =
    typeof b.message === "string" && b.message.trim() ? b.message.trim() : null;

  return {
    ok: true,
    data: { full_name, email, source, company, message },
  };
}

export async function POST(req: Request) {
  let body: unknown;

  // checks input is in json format and that it meets all criteria needed for a lead (as specified in specs)
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = validate(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }


  // checks environment variables exist
  let supabaseAnon;
  let supabaseAdmin;

  try {
    supabaseAnon = getSupabaseAnon();
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    console.error("Supabase config error:", err);
    return NextResponse.json(
      { error: "Server is not configured correctly" },
      { status: 500 }
    );
  }

  // inserts validated lead into database
  const { data: lead, error: insertError } = await supabaseAdmin
    .from("leads")
    .insert(result.data)
    .select()
    .abortSignal(AbortSignal.timeout(TIMEOUT_MS))
    .single();

  if (insertError?.code === "23505") {
    return NextResponse.json(
      { error: "A submission with this email already exists." },
      { status: 409 }
    );
  }

  if (insertError || !lead) {
    console.error("Supabase insert failed:", insertError);
    return NextResponse.json(
      { error: "Unable to submit form right now. Please try again." },
      { status: 500 }
    );
  }

  // POSTs lead to webhook with timeout; failures are logged but don't fail the request
  let webhookError: string | null = null;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Candidate-Name": process.env.CANDIDATE_NAME ?? "",
      },
      body: JSON.stringify(result.data),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Webhook responded with status ${res.status}`);
  } catch (err) {
    webhookError = err instanceof Error ? err.message : String(err);
    console.error("Webhook delivery failed:", webhookError);
  }

  const statusUpdate = webhookError
    ? { webhook_status: "failed", webhook_error: webhookError }
    : { webhook_status: "sent" };

  const { error: updateError } = await supabaseAdmin
    .from("leads")
    .update(statusUpdate)
    .eq("id", lead.id)
    .abortSignal(AbortSignal.timeout(TIMEOUT_MS));

  if (updateError) {
    console.error("Failed to update webhook_status:", updateError);
  }

  // return success code to user regardless of webhook outcome
  return NextResponse.json({ ok: true, lead }, { status: 201 });
}
