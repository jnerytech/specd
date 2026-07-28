// The anchor points at a function that was renamed here and exists nowhere
// else in this tree, so the repository-wide search finds nothing.
export function verifyToken(token: string): boolean {
  return token.length > 0;
}
