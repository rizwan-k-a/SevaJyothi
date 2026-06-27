import { backend } from "../providers/backendProvider";

export const signIn = (email, password) => backend.auth.signIn(email, password);
export const signUp = (email, password, displayName) => backend.auth.signUp(email, password, displayName);
export const signOut = () => backend.auth.signOut();
export const currentUser = () => backend.auth.currentUser();
export const rolesFor = (userId) => backend.auth.rolesFor(userId);
export const onAuthChange = (cb) => backend.auth.onAuthChange(cb);
