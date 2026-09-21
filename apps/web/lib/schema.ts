import { siteConfig } from "./config.js";

const root = "https://blode.co";
export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@id": `${siteConfig.url}/#webpage`,
      "@type": "WebPage",
      about: { "@id": `${siteConfig.url}/#software` },
      breadcrumb: { "@id": `${siteConfig.url}/#breadcrumb` },
      description: siteConfig.description,
      inLanguage: "en",
      isPartOf: { "@id": `${root}/#website` },
      mainEntity: { "@id": `${siteConfig.url}/#software` },
      name: siteConfig.title,
      url: siteConfig.url,
    },
    {
      "@id": `${siteConfig.url}/#software`,
      "@type": "SoftwareApplication",
      applicationCategory: "DeveloperApplication",
      author: { "@id": `${root}/#person` },
      description: siteConfig.description,
      image: `${siteConfig.url}/opengraph-image`,
      installUrl: siteConfig.links.npm,
      license: siteConfig.links.license,
      name: siteConfig.name,
      publisher: { "@id": `${root}/#organization` },
      sameAs: [
        siteConfig.links.github,
        "https://www.npmjs.com/package/taste-lint",
      ],
      softwareRequirements: "Node.js 24.11 or later",
      url: siteConfig.url,
    },
    {
      "@id": `${siteConfig.url}/#breadcrumb`,
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", item: root, name: "Matthew Blode", position: 1 },
        {
          "@type": "ListItem",
          item: `${root}/projects`,
          name: "Projects",
          position: 2,
        },
        {
          "@type": "ListItem",
          item: siteConfig.url,
          name: siteConfig.name,
          position: 3,
        },
      ],
    },
  ],
};
