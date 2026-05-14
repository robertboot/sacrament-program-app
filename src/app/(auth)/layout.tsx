import { BrandStack } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <BrandStack className="max-w-[14rem]" />
        </div>
        {children}
      </div>
    </main>
  );
}
