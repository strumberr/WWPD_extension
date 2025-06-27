import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(<Popup/>);
} else {
  console.error("No root element found in popup.html");
}
