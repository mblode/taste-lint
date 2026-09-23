export interface FaqItem {
  question: string;
  answer: string;
}

/** FAQPage JSON-LD built from the same array the visible FAQ renders. */
export const faqJsonLd = (items: FaqItem[], id?: string) => ({
  ...(id ? { "@id": id } : {}),
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    acceptedAnswer: { "@type": "Answer", text: item.answer },
    name: item.question,
  })),
});
