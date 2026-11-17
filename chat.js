import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyCmeHA37L-kwgt6FnrpqrXHvM7IjvsNVRs",
    authDomain: "wazzup-0021.firebaseapp.com",
    projectId: "wazzup-0021",
    storageBucket: "wazzup-0021.firebasestorage.app",
    messagingSenderId: "960018982217",
    appId: "1:960018982217:web:1a196e52060b2140a2e698"
};

// INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const messagesArea = document.getElementById("messagesArea");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

const params = new URLSearchParams(window.location.search);
const recipientUid = params.get("uid");

let currentUser = null;
let chatId = null;

if (!recipientUid) {
    alert("Chat user not selected!");
    window.location.href = "home.html";
}

// LOGIN CHECK
onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    if (!recipientUid) return;

    chatId = [currentUser.uid, recipientUid].sort().join("_");

    try {
        const userDoc = await getDoc(doc(db, "users", recipientUid));

        if (userDoc.exists()) {
            const data = userDoc.data();

            document.getElementById("chatName").textContent =
                data.name || "Wazzup User";

            document.querySelector(".chat-avatar").textContent =
                (data.name || "U").charAt(0).toUpperCase();

            document.getElementById("chatStatus").textContent = "Wazzup";
        }

    } catch (error) {
        console.log(error.message);
    }

});
