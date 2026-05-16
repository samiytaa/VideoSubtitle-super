import { useReducer, useEffect } from 'react';
import { AppTab } from '../components/app/AppHeader';
import { getCurrentRoutePath, syncHashRoute } from '../utils/runtimeConfig';

type Tab = AppTab;

type PendingDeduplication = {
  dialogue: boolean;
  location: boolean;
} | null;

interface AppState {
  activeTab: Tab;
  pendingDeduplication: PendingDeduplication;
}

type AppAction =
  | { type: 'SET_ACTIVE_TAB'; payload: Tab }
  | { type: 'SET_PENDING_DEDUPLICATION'; payload: PendingDeduplication };

const TAB_TO_PATH: Record<Tab, string> = {
  extract: '/',
  gallery: '/img',
  proofread2: '/proofread',
  baimiao: '/baimiao-ocr',
  aichat: '/ai-chat',
};

const PATH_TO_TAB: Record<string, Tab> = {
  '/': 'extract',
  '/img': 'gallery',
  '/proofread': 'proofread2',
  '/baimiao-ocr': 'baimiao',
  '/ai-chat': 'aichat',
  '/ocr': 'aichat',
};

const KNOWN_ROUTE_PATHS = Object.values(TAB_TO_PATH);

function getTabFromLocation(): Tab {
  return PATH_TO_TAB[getCurrentRoutePath(KNOWN_ROUTE_PATHS)] ?? 'extract';
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      if (state.activeTab === action.payload) return state;
      return { ...state, activeTab: action.payload };
    case 'SET_PENDING_DEDUPLICATION':
      return { ...state, pendingDeduplication: action.payload };
    default:
      return state;
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(appReducer, {
    activeTab: 'extract',
    pendingDeduplication: null,
  });

  // Tab 路由管理
  useEffect(() => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: getTabFromLocation() });

    const handleRouteChange = () => {
      const nextTab = getTabFromLocation();
      dispatch({ type: 'SET_ACTIVE_TAB', payload: nextTab });
    };

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  useEffect(() => {
    const targetPath = TAB_TO_PATH[state.activeTab];
    const currentPath = getCurrentRoutePath(KNOWN_ROUTE_PATHS);
    if (currentPath !== targetPath) {
      syncHashRoute(targetPath);
    }
  }, [state.activeTab]);

  return {
    activeTab: state.activeTab,
    pendingDeduplication: state.pendingDeduplication,
    setActiveTab: (tab: Tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }),
    setPendingDeduplication: (pending: PendingDeduplication) =>
      dispatch({ type: 'SET_PENDING_DEDUPLICATION', payload: pending }),
  };
}
