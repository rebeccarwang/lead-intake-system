import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_SOURCES = ["Google", "Referral", "Social", "Other"];

// REPLACE PLACEHOLDER URL
const WEBHOOK_URL = "https://my_placeholder.com";
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

type LeadInput = {
  full_name: string;
  email: string;
  company?: string | null;
  source: Source;
  message?: string | null;
};


// creates supabaseAnon
function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are not configured for anon");
  }
  return createClient(url, anonKey);
}


// creates supabaseAdmin
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ADMIN_KEY;
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

  const source = typeof b.source === "string" ? b.source : "";
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

  // inserts lead
  const { data: lead, error: insertError } = await supabaseAnon
    .from("leads")
    .insert(result.data)
    .select()
    .single();

  if (insertError || !lead) {
    console.error("Supabase insert failed:", insertError);
    return NextResponse.json(
      { error: "Unable to submit form right now." },
      { status: 500 }
    );
  }

  // attempts to POST lead data server-side to webhook endpoint
  try {
    const webhookRes = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Candidate-Name": process.env.CANDIDATE_NAME ?? "",
      },
      body: JSON.stringify(lead),
    });

    if (!webhookRes.ok) {
      throw new Error(`Webhook responded with status ${webhookRes.status}`);
    }

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update({ webhook_status: "sent" })
      .eq("id", lead.id);

    if (updateError) {
      console.error("Failed to update webhook_status to sent:", updateError);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Webhook delivery failed:", errorMessage);

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update({ webhook_status: "failed", webhook_error: errorMessage })
      .eq("id", lead.id);

    if (updateError) {
      console.error("Failed to update webhook_status to failed:", updateError);
    }
  }

  return NextResponse.json({ ok: true, lead }, { status: 201 });
}
