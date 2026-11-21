import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Sends each role to its natural landing page. */
export function HomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={role === 'customer' ? '/app/book' : '/app/dashboard'} replace />;
}
