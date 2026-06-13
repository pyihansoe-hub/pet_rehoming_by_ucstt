import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⚠️ မင်းရဲ့ Firebase Project ထဲက Key အစစ်တွေကို ဒီအောက်မှာ သေချာချိန်းပေးပါ
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_FIREBASE_API_KEY", // ဒီနေရာမှာ မင်းရဲ့ Key အစစ် ထည့်ပါ
  authDomain: "your-pet-project.firebaseapp.com",
  projectId: "your-pet-project",
  storageBucket: "your-pet-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:12345:web:abcde"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);