import { usePath } from './router.js';
import Home from './Home.jsx';
import App from './App.jsx';

export default function Root() {
  const path = usePath();
  return path.startsWith('/app') ? <App /> : <Home />;
}
