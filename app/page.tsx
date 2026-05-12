"use client";

import { useState } from "react";

const SOURCES = ["Google", "Referral", "Social", "Other"] as const;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

type FormState = {
  full_name: string;
  email: string;
  company: string;
  source: string;
  message: string;
};

const initialForm: FormState = {
  full_name: "",
  email: "",
  company: "",
  source: "",
  message: "",
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.full_name.trim()) {
    errors.full_name = "Full name is required.";
  }

  const email = form.email.trim();
  if (!email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!form.source) {
    errors.source = "Please select how you heard about us.";
  }

  return errors;
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          company: form.company.trim() || null,
          source: form.source,
          message: form.message.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setForm(initialForm);
      setErrors({});
      setSuccess(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Network error. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Get in touch</h1>
        <p className="mt-1 text-sm text-gray-600">
          Fill out the form and we&apos;ll be in touch.
        </p>

        {success ? (
          <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              Thanks! We received your submission.
            </p>
            <button
              type="button"
              onClick={() => setSuccess(false)}
              className="mt-3 text-sm font-medium text-green-700 underline hover:text-green-800"
            >
              Submit another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                type="text"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                aria-invalid={!!errors.full_name}
                aria-describedby={errors.full_name ? "full_name-error" : undefined}
                className={inputClass}
              />
              {errors.full_name && (
                <p id="full_name-error" className="mt-1 text-sm text-red-600">
                  {errors.full_name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={inputClass}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                Company
              </label>
              <input
                id="company"
                type="text"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="source" className="block text-sm font-medium text-gray-700">
                How did you hear about us? <span className="text-red-500">*</span>
              </label>
              <select
                id="source"
                value={form.source}
                onChange={(e) => update("source", e.target.value)}
                aria-invalid={!!errors.source}
                aria-describedby={errors.source ? "source-error" : undefined}
                className={inputClass}
              >
                <option value="">Select an option</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.source && (
                <p id="source-error" className="mt-1 text-sm text-red-600">
                  {errors.source}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                Message
              </label>
              <textarea
                id="message"
                rows={4}
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                className={inputClass}
              />
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
