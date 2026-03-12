export async function readJsonSafely<T>(
  response: Response,
): Promise<T | Record<string, unknown>> {
  const rawBody = await response.text();
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return { message: rawBody };
  }
}
