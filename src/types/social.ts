export interface Profile {
  id: string;
  username: string | null;
  displayName: string | null;
  termsAcceptedAt: string | null;
}

export function isProfileComplete(profile: Profile): boolean {
  return Boolean(profile.username && profile.termsAcceptedAt);
}
