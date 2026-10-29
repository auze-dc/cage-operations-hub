// Use the caller's client, never a service-role client, for this check.
// The database validates signed session claims against administrator roles and
// verified factors. Do not trust user_metadata or decode an unverified token.
export async function assertStaffMfa(client: {rpc: (name: string) => any}): Promise<string | null> {
 try {
  const result=await client.rpc("hub_assert_mfa");
  return result.error ? "Two-step verification is required or your secure session could not be checked. Reload CAGE and sign in again." : null;
 } catch {
  return "Your secure session could not be checked. Retry before continuing.";
 }
}
