// The MAHI engine (dashboard, 21 pages, charts, MAHI character, Excel builder/importer).
// These modules attach to window (MAHI_DATA, MAHI_STORE, MAHI_SYNC, MAHI_UI, MAHI_APP …)
// and must load in this order.
import './app.css';
import './theme-v2.css'; // MAHI V2 design system + seasonal themes
import './data.js';
import './workbook.js';
import './store.js';
import './cloud2.js'; // record-level cloud sync (schema v2); sync.js (v1 documents) is kept only for its legacy tests
import './report.js';
import './chat.js';
import './charts.js';
import './mahi.js';
import './ui.js';
import './pages1.js';
import './pages2.js';
import './app.js';
