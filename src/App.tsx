import { useState, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { AuthCallback } from './components/AuthCallback';
import { AuthenticatedAppView } from './components/AuthenticatedAppView';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ToastProvider } from './components/Toast';
import { useToast } from './components/toastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useDashboardState } from './hooks/useDashboardState';

const Home = lazy(() => import('./components/Home').then((module) => ({ default: module.Home })));

function AppContent() {
  const location = useLocation();
  const [showLogin, setShowLogin] = useState(true);
  const { showToast } = useToast();
  const {
    isAuthenticated,
    user,
    decks,
    selectedDeck,
    editingDeck,
    markAuthenticated,
    logoutUser,
    refreshUser,
    createDeck,
    updateDeckById,
    deleteDeckById,
    selectDeck,
    exitStudyMode,
    startEditingDeck,
    stopEditingDeck,
  } = useDashboardState(showToast);

  const handleAuthError = (error: Error | string) => {
    const message = typeof error === 'string' ? error : error.message;
    if (message.toLowerCase().includes('not authorized')) {
      showToast('This email is not authorized. Please contact administrator or use a different email.', 'error');
    } else {
      showToast('Authentication failed. Please try again.', 'error');
    }
  };

  if (location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  if (!isAuthenticated) {
    if (location.pathname === '/') {
      return <Suspense fallback={<LoadingSpinner />}><Home /></Suspense>;
    }

    return (
      <div className="min-h-screen bg-gray-100">
        {showLogin ? (
          <Login
            onLogin={markAuthenticated}
            onError={handleAuthError}
            onToggleForm={() => setShowLogin(false)}
          />
        ) : (
          <Signup
            onSignup={markAuthenticated}
            onError={handleAuthError}
            onToggleForm={() => setShowLogin(true)}
          />
        )}
      </div>
    );
  }

  return (
    <AuthenticatedAppView
      user={user}
      decks={decks}
      selectedDeck={selectedDeck}
      editingDeck={editingDeck}
      onLogout={logoutUser}
      onRefreshUser={refreshUser}
      onDeckCreated={createDeck}
      onDeckUpdate={updateDeckById}
      onDeckDelete={deleteDeckById}
      onSelectDeck={selectDeck}
      onEditDeck={startEditingDeck}
      onStopEditing={stopEditingDeck}
      onExitStudyMode={exitStudyMode}
    />
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
