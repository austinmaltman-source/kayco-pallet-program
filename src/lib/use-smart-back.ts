import { useLocation, useNavigate } from 'react-router-dom'

// Go back to wherever the user came from. If they landed on this page
// directly (deep link, refresh) and have no in-app history, fall back to
// the supplied route instead of dumping them out of the SPA.
// React Router stamps location.key='default' on the initial entry only;
// any in-app navigate() assigns a fresh key, so that's the reliable signal.
export function useSmartBack(): (fallback: string) => void {
  const navigate = useNavigate()
  const location = useLocation()
  return (fallback: string) => {
    if (location.key === 'default') navigate(fallback)
    else navigate(-1)
  }
}
