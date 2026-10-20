// Only the service-role client may call the verification RPC. Never log the token.
export async function validCronToken(db, token) {
 if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false;
 const result = await db.rpc('verify_opportunity_cron_token', { token });
 if (result.error) throw new Error('Scheduled scan authentication unavailable');
 return result.data === true;
}
