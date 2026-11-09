/** Loads the browser client of Supabase the first time it is needed: it is a big piece of code that most visits never use (only playing a game and checking a @username talk to the database from the browser). */
export async function loadBrowserClient() {
  const { createClient } = await import("./client");
  return createClient();
}
