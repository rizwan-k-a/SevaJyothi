import type { Role, SessionUser } from "./types";

export interface AuthProvider {
  signIn(email: string, password: string): Promise<{ userId: string }>;
  signUp(email: string, password: string, displayName?: string): Promise<{ userId: string }>;
  signOut(): Promise<void>;
  currentUser(): Promise<SessionUser | null>;
  rolesFor(userId: string): Promise<Role[]>;
  onAuthChange(cb: (user: SessionUser | null) => void): () => void;
}
