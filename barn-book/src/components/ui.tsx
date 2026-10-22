import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-serif text-lg text-ink mt-6 mb-2 border-b border-line pb-1">
      {children}
    </h2>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-soft text-sm py-3 px-1">{children}</p>
  );
}

export function PrimaryButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-11 px-4 rounded-sm bg-brass text-card font-medium disabled:opacity-60 ${className}`}
    />
  );
}

export function QuietButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-11 px-4 rounded-sm border border-line bg-card text-ink disabled:opacity-60 ${className}`}
    />
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-soft">{label}</span>
      {children}
      {hint && <span className="block text-xs text-soft mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "mt-1 w-full min-h-11 rounded-sm border border-line bg-card px-3 text-ink";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputClass} py-2 ${props.className ?? ""}`}
    />
  );
}
