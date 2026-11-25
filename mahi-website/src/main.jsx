import React from 'react';
import { createRoot } from 'react-dom/client';
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import JSZip from 'jszip';
import './index.css';
import './legacy/index.js';
import App from './App.jsx';

// The Excel builder/importer expects these as browser globals (used only when exporting/importing).
window.ExcelJS = ExcelJS;
window.JSZip = JSZip;

// No React.StrictMode: the MAHI engine must boot exactly once per page load.
createRoot(document.getElementById('root')).render(<App />);
