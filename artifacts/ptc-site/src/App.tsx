import { useState } from 'react';
import { Page } from '@/components/NavBar';
import { Home } from '@/pages/Home';
import { Events } from '@/pages/Events';
import { Communities } from '@/pages/Communities';
import { CommunityDetail } from '@/pages/CommunityDetail';

interface AppState {
  page: Page;
  communityId?: string;
}

export default function App() {
  const [state, setState] = useState<AppState>({ page: 'home' });

  function navigate(page: Page, communityId?: string) {
    setState({ page, communityId });
    window.scrollTo(0, 0);
  }

  if (state.page === 'events') {
    return <Events onNavigate={navigate} />;
  }
  if (state.page === 'communities') {
    return <Communities onNavigate={navigate} />;
  }
  if (state.page === 'community-detail' && state.communityId) {
    return <CommunityDetail communityId={state.communityId} onNavigate={navigate} />;
  }
  return <Home onNavigate={navigate} />;
}
