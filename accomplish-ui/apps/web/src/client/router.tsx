import { createHashRouter, Navigate, redirect } from 'react-router';
import { HomePage } from './pages/Home';
import ExecutionPage from './pages/Execution';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { RouteErrorFallback } from './components/ui/RouteErrorFallback';
import { isLoggedIn } from './lib/session';
import { isAdminSession } from './lib/session';
import { AdminPage } from './pages/AdminPage';

/** Auth guard — redirects to /signup if no session (new users land on sign-up first). */
function requireAuth() {
  if (!isLoggedIn()) return redirect('/signup');
  return null;
}

function requireAdmin() {
  if (!isLoggedIn()) return redirect('/signup');
  if (!isAdminSession()) return redirect('/');
  return null;
}

export const router = createHashRouter([
  // Public auth routes
  { path: '/login', Component: LoginPage },
  { path: '/signup', Component: SignUpPage },
  { path: '/forgot-password', Component: ForgotPasswordPage },
  { path: '/reset-password', Component: ResetPasswordPage },
  { path: '/admin', Component: AdminPage, loader: requireAdmin, errorElement: <RouteErrorFallback /> },

  // Protected app routes
  {
    path: '/',
    lazy: async () => {
      const { App } = await import('./App');
      return { Component: App };
    },
    errorElement: <RouteErrorFallback />,
    loader: requireAuth,
    children: [
      {
        index: true,
        Component: HomePage,
        errorElement: <RouteErrorFallback />,
      },
      {
        path: 'execution/:id',
        Component: ExecutionPage,
        errorElement: <RouteErrorFallback />,
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
