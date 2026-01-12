/**
 * Check if an email is in the ADMIN_EMAIL list
 * ADMIN_EMAIL can be a single email or comma-separated list
 */
export function isAdminEmail(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAIL || '';
  if (!adminEmails) return false;
  
  const emailList = adminEmails
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0); // Filter out empty strings from misconfigured commas
  
  return emailList.includes(email.trim().toLowerCase()); // Also trim input for consistency
}
