import { ErrorBoundary } from './src/components/ErrorBoundary';
import { InviteCapture } from './src/components/InviteCapture';
import { AuthProvider } from './src/contexts/AuthContext';
import { ProfileProvider } from './src/contexts/ProfileContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <InviteCapture />
        <ProfileProvider>
          <RootNavigator />
        </ProfileProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
