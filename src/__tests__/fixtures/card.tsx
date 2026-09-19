import { cn } from "@/lib/utils";

const ERRORS = {
  EMAIL_TAKEN: { message: "Email already in use." },
  GENERIC: { message: "Something went wrong" },
};

export function Card({ busy }: { busy: boolean }) {
  console.error("Something went wrong in the card");
  if (busy) {
    throw new Error("Card is busy, try again");
  }
  return (
    <section className="rounded-lg border p-4">
      <p className="text-[17px] font-semibold">Notification rules</p>
      <p className="text-[15px] font-semibold">
        Choose which sync events reach your inbox.
      </p>
      <p className="text-2xl font-semibold">Billing</p>
      <p className="text-sm text-muted-foreground">Invoices and tax details.</p>
      <button
        aria-label="Delete invoice"
        className={cn("rounded-md px-3", busy && "opacity-50")}
        type="button"
      >
        Submit
      </button>
      <input placeholder="Enter your email" type="email" />
      <span>{t("some.key")}</span>
      <p>It's a "quoted" line with {"an expression string"}.</p>
      <p className="text-xs tracking-wide">
        A long line of body copy that has positive letter spacing applied to it.
      </p>
    </section>
  );
}

const t = (key: string) => key;
