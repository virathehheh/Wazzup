
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyCmeHA37L-kwgt6FnrpqrXHvM7IjvsNVRs",
    authDomain: "wazzup-0021.firebaseapp.com",
    projectId: "wazzup-0021",
    storageBucket: "wazzup-0021.firebasestorage.app",
    messagingSenderId: "960018982217",
    appId: "1:960018982217:web:1a196e52060b2140a2e698"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profileUsername = document.getElementById("profileUsername");

const detailName = document.getElementById("detailName");
const detailUsername = document.getElementById("detailUsername");
const detailEmail = document.getElementById("detailEmail");
const detailBio = document.getElementById("detailBio");

const editButton = document.getElementById("editProfileButton");
const logoutButton = document.getElementById("logoutButton");

let currentUser = null;
let currentData = {};


async function loadProfile(user) {
    currentUser = user;

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            alert("Profile data not found!");
            return;
        }

        currentData = userSnap.data();

        const name = currentData.name || "Wazzup User";
        const username = currentData.username || "username";
        const email = currentData.email || user.email || "Not available";
        const bio = currentData.bio || "No bio added";

        profileAvatar.textContent = name.charAt(0).toUpperCase();
        profileName.textContent = name;
        profileUsername.textContent = "@" + username;

        detailName.textContent = name;
        detailUsername.textContent = username;
        detailEmail.textContent = email;
        detailBio.textContent = bio;

    } catch (error) {
        console.error(error);
        alert("Unable to load profile: " + error.message);
    }
}


onAuthStateChanged(auth, (user) => {
    if (user) {
        loadProfile(user);
    } else {
        window.location.href = "index.html";
    }
});


editButton.addEventListener("click", async () => {

    if (!currentUser) return;

    const newName = prompt(
        "Enter your full name:",
        currentData.name || ""
    );

    if (newName === null) return;

    const newUsername = prompt(
        "Enter your username:",
        currentData.username || ""
    );

    if (newUsername === null) return;

    const newBio = prompt(
        "Write your bio:",
        currentData.bio || ""
    );

    if (newBio === null) return;

    if (!newName.trim() || !newUsername.trim()) {
        alert("Name and username cannot be empty!");
        return;
    }

    try {
        const userRef = doc(db, "users", currentUser.uid);

        await updateDoc(userRef, {
            name: newName.trim(),
            username: newUsername.trim().replace("@", ""),
            bio: newBio.trim()
        });

        alert("Profile updated successfully!");

        await loadProfile(currentUser);

    } catch (error) {
        console.error(error);
        alert("Profile update failed: " + error.message);
    }
});


logoutButton.addEventListener("click", async () => {

    const confirmLogout = confirm("Are you sure you want to logout?");

    if (!confirmLogout) return;

    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (error) {
        alert("Logout failed: " + error.message);
    }
});
