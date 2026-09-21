export function ZoneBreadcrumb() {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-3 text-sm">
        <li>
          <a
            className="inline-flex min-h-12 items-center hover:underline"
            href="https://blode.co"
            rel="author"
          >
            Matthew Blode
          </a>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <a
            className="inline-flex min-h-12 items-center hover:underline"
            href="https://blode.co/projects"
          >
            Projects
          </a>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">Taste Lint</li>
      </ol>
    </nav>
  );
}
