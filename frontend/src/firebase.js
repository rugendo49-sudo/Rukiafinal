import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAPfxpull1xoi2HucD-vcO6kKknIZ2P9K8",
  authDomain: "omoka-73f48.firebaseapp.com",
  projectId: "omoka-73f48",
  storageBucket: "omoka-73f48.firebasestorage.app",
  messagingSenderId: "1025422986681",
  appId: "1:1025422986681:web:deb539f7cb6a30fad77a68",
  measurementId: "G-DC4DY0DZFC",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// Analytics is intentionally not initialized here: getAnalytics() requires
// a real browser environment with measurement APIs available, and this is
// a login/gameplay integration, not an analytics one. Add it back with
// `import { getAnalytics } from "firebase/analytics"` if you want
// pageview/event tracking later.
