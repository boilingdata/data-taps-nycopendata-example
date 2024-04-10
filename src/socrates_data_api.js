export function getSodaQueryParams(limit = 1000, offset = 0, filter = "", order = ":id") {
  return (
    `?$limit=${limit}` +
    `&$offset=${offset}` +
    `&$order=${encodeURIComponent(order)}` +
    (filter ? `&$where=${encodeURIComponent(filter)}` : "")
  );
}
