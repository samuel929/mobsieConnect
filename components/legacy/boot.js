/* Loads the Control Centre modules in dependency order (side-effecting IIFEs
   that attach to window: MCIcon, DB, Charts, UI, App, Pages). Imported once,
   client-side only, from AppShell. */
import './icons';
import './data';
import './api-data';
import './charts';
import './ui';
import './app-core';

import './pages/dashboard';
import './pages/platform';
import './pages/admissions';
import './pages/people';
import './pages/academics';
import './pages/finance';
import './pages/comms';
import './pages/media';
import './pages/shop';
import './pages/insights';
import './pages/system';
