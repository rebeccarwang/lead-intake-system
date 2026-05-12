import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Lead = {
  full_name: string;
  email: string;
  company: string | null;
  source: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function getLeads(): Promise<{ leads: Lead[] | null; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return { leads: null, error: "Server is not configured correctly." };
  }

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase
    .from("leads")
    .select("full_name, email, company, source, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load leads:", error);
    return { leads: null, error: "Unable to load leads right now." };
  }

  return { leads: data ?? [], error: null };
}

export default async function LeadsPage() {
  const { leads, error } = await getLeads();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-600">
          All submitted leads, most recent first.
        </p>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
          {error ? (
            <div className="p-6 text-sm text-red-700">{error}</div>
          ) : !leads || leads.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              No leads yet. Submissions will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Company</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Submitted Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {leads.map((lead) => (
                    <tr key={`${lead.email}-${lead.created_at}`}>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-900">{lead.full_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{lead.email}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{lead.company ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{lead.source}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDate(lead.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
