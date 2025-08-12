// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGL8IZxxfV3xKS1rebB-4k4NSDLAGg8r0",
  authDomain: "padel-tracker-afc.firebaseapp.com",
  projectId: "padel-tracker-afc",
  storageBucket: "padel-tracker-afc.firebasestorage.app",
  messagingSenderId: "29136495615",
  appId: "1:29136495615:web:2699ada2099ae8d4dcfdca",
  measurementId: "G-Q9Y3JV15YV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Save a match to Firestore collection "matches"
export async function saveMatchToFirebase(match) {
  try {
    console.log("Match data to save:", match);
    await addDoc(collection(db, "matches"), match);
    console.log("Match saved to Firebase!");
  } catch (error) {
    console.error("Error saving match to Firebase:", error);
  }
}
