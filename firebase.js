import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbTOhQznWjkrkIhS7Ee1O7Y37e81ZdVm8",
  authDomain: "notesvault-dbe4b.firebaseapp.com",
  projectId: "notesvault-dbe4b",
  storageBucket: "notesvault-dbe4b.firebasestorage.app",
  messagingSenderId: "460447999957",
  appId: "1:460447999957:web:8fefc13aab1a2c4895bf5c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);