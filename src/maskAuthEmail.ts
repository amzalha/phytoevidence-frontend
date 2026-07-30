/**
 * Returns a privacy-preserving identity for the authenticated header.
 *
 * Examples:
 * - amzalhassane@gmail.com -> amz…@gmail.com
 * - ab@example.org         -> a…@example.org
 * - longidentifier         -> lon…
 */
export function maskAuthEmail(email?: string | null): string {
  if (!email) {
    return "";
  }

  const atIndex = email.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === email.length - 1) {
    return email.length <= 4
      ? email
      : `${email.slice(0, 3)}…`;
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const visibleLength = localPart.length <= 2 ? 1 : 3;

  return `${localPart.slice(0, visibleLength)}…@${domain}`;
}
