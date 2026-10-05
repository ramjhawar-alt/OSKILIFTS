import { AuthProvider } from './src/contexts/AuthContext';
import { ProfileProvider } from './src/contexts/ProfileContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <RootNavigator />
      </ProfileProvider>
    </AuthProvider>
  );
}
