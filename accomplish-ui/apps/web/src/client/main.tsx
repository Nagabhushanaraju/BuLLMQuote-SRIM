import './lib/accomplish-backend';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { initI18n } from './i18n';
import { router } from './router';
import { initAppearance } from './lib/appearance';
import { AppMotionConfig } from './components/AppMotionConfig';
import './styles/globals.css';
import './styles/appearance.css';

// Apply persisted appearance prefs (accent, dim, motion, pattern) before render.
initAppearance();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

void initI18n().then(() => {
  root.render(
    <StrictMode>
      <AppMotionConfig>
        <RouterProvider router={router} />
      </AppMotionConfig>
    </StrictMode>,
  );
});
