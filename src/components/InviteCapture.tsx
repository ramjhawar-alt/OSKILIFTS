import { useEffect } from 'react';
import { Linking } from 'react-native';

import { capturePendingInvite } from '../services/inviteService';

/** Notices invite links (on the web, the page address itself) as soon as the app opens. Renders nothing. */
export const InviteCapture = () => {
  useEffect(() => {
    let active = true;
    Linking.getInitialURL()
      .then((url) => {
        if (active) capturePendingInvite(url);
      })
      .catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      capturePendingInvite(url);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return null;
};
