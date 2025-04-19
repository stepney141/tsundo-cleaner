import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import StatsPage from './pages/StatsPage';
import './App.css';

/**
 * アプリケーションのルートコンポーネント
 */
function App() {
  // ルーター設定
  const router = createBrowserRouter([
    {
      path: '/',
      element: <HomePage />,
    },
    {
      path: '/search',
      element: <SearchPage />,
    },
    {
      path: '/stats',
      element: <StatsPage />,
    },
  ]);

  return <RouterProvider router={router} />;
}

export default App;
