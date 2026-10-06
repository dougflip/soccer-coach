import { RouterProvider } from "@tanstack/react-router";
import { LoginPage } from "../features/auth/LoginPage.tsx";
import { AuthProvider, useAuth } from "./auth.tsx";
import { router } from "./router.tsx";
import { SyncProvider } from "./sync.tsx";
import { TeamGate, useTeamId } from "./team.tsx";

export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const auth = useAuth();
  if (auth.status === "loading") return null;
  if (auth.status === "signedOut") return <LoginPage />;
  const { user } = auth.session;
  return (
    <TeamGate key={user.id} userId={user.id} email={user.email ?? user.id}>
      <SyncedApp />
    </TeamGate>
  );
}

function SyncedApp() {
  const teamId = useTeamId();
  return (
    <SyncProvider key={teamId} teamId={teamId}>
      <RouterProvider router={router} />
    </SyncProvider>
  );
}
