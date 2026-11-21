const textQueryKeys = ["search", "company", "tag"] as const;

export function sanitizeContactQuery(params: URLSearchParams): string {
  const sanitized = new URLSearchParams();

  for (const key of textQueryKeys) {
    const value = params.get(key);
    if (value !== null) sanitized.set(key, value);
  }

  const sort = params.get("sort");
  if (sort === "name" || sort === "createdAt") {
    sanitized.set("sort", sort);
  }

  const order = params.get("order");
  if (order === "asc" || order === "desc") {
    sanitized.set("order", order);
  }

  const page = params.get("page");
  if (page !== null) {
    const pageNumber = Number(page);
    if (Number.isInteger(pageNumber) && pageNumber >= 1) {
      sanitized.set("page", page);
    }
  }

  return sanitized.toString();
}
