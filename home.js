
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    getDocs
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

const usersList = document.getElementById("usersList");
const userSearch = document.getElementById("userSearch");

let allUsers = [];

// SHOW USERS
function displayUsers(users) {

    usersList.innerHTML = "";

    if (users.length === 0) {
        usersList.textContent = "No users found.";
        return;
    }

    users.forEach(user => {

        const item = document.createElement("div");
        item.className = "chat-item";

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.textContent = (user.name || "U").charAt(0).toUpperCase();

        const info = document.createElement("div");
        info.className = "chat-info";

        const name = document.createElement("h4");
        name.textContent = user.name || "Wazzup User";

        const username = document.createElement("p");
        username.textContent = "@" + (user.username || "user");

        info.appendChild(name);
        info.appendChild(username);

        item.appendChild(avatar);
        item.appendChild(info);

        usersList.appendChild(item);
    });
}

// LOAD REAL USERS
onAuthStateChanged(auth, async (currentUser) => {

    if (!currentUser) {
        window.location.href = "index.html";
        return;
    }

    try {

        const snapshot = await getDocs(collection(db, "users"));

        allUsers = [];

        snapshot.forEach(document => {

            const user = document.data();

            // Hide currently logged-in user
            if (document.id !== currentUser.uid) {
                allUsers.push(user);
            }
        });

        displayUsers(allUsers);

    } catch (error) {

        usersList.textContent = "Error loading users: " + error.message;

    }
});

// SEARCH USERS
userSearch.addEventListener("input", function () {

    const searchText = userSearch.value.toLowerCase().trim();

    const filteredUsers = allUsers.filter(user => {

        const name = (user.name || "").toLowerCase();
        const username = (user.username || "").toLowerCase();

        return name.includes(searchText) ||
               username.includes(searchText);
    });

    displayUsers(filteredUsers);
});
