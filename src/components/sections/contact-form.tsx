"use client";

import * as React from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { contactFormSchema, type ContactFormValues } from "@/lib/validations/contact";

type Status = "idle" | "submitting" | "success" | "error";

const initialValues: ContactFormValues = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  website: "",
};

export function ContactForm() {
  const [values, setValues] = React.useState<ContactFormValues>(initialValues);
  const [errors, setErrors] = React.useState<Partial<Record<keyof ContactFormValues, string>>>({});
  const [status, setStatus] = React.useState<Status>("idle");

  const handleChange =
    (field: keyof ContactFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = contactFormSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof ContactFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ContactFormValues;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setStatus("submitting");

    try {
      const res = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) throw new Error("request_failed");

      setStatus("success");
      setValues(initialValues);
    } catch {
      setStatus("error");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none ring-ring transition-shadow focus-visible:ring-2";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* Honeypot: invisible para personas, atractivo para bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Sitio web</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={handleChange("website")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Nombre
          </label>
          <input
            id="name"
            required
            className={inputClass}
            value={values.name}
            onChange={handleChange("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="mt-1.5 text-xs text-destructive">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            className={inputClass}
            value={values.email}
            onChange={handleChange("email")}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="mt-1.5 text-xs text-destructive">{errors.email}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
          Teléfono (opcional)
        </label>
        <input
          id="phone"
          className={inputClass}
          value={values.phone}
          onChange={handleChange("phone")}
          aria-invalid={!!errors.phone}
        />
        {errors.phone && <p className="mt-1.5 text-xs text-destructive">{errors.phone}</p>}
      </div>

      <div>
        <label htmlFor="subject" className="mb-1.5 block text-sm font-medium">
          Asunto
        </label>
        <input
          id="subject"
          required
          className={inputClass}
          value={values.subject}
          onChange={handleChange("subject")}
          aria-invalid={!!errors.subject}
        />
        {errors.subject && <p className="mt-1.5 text-xs text-destructive">{errors.subject}</p>}
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
          Mensaje
        </label>
        <textarea
          id="message"
          required
          rows={5}
          className={cn(inputClass, "resize-none")}
          value={values.message}
          onChange={handleChange("message")}
          aria-invalid={!!errors.message}
        />
        {errors.message && <p className="mt-1.5 text-xs text-destructive">{errors.message}</p>}
      </div>

      <Button type="submit" size="lg" variant="accent" disabled={status === "submitting"}>
        {status === "submitting" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Enviar mensaje
      </Button>

      {status === "success" && (
        <p role="status" className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Mensaje enviado. Te responderemos pronto.
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="size-4" aria-hidden="true" />
          No fue posible enviar tu mensaje. Intenta de nuevo en un momento.
        </p>
      )}
    </form>
  );
}
