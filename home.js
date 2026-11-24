
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

const usersList = document.getElementById("usersList");
const userSearch = document.getElementById("userSearch");

let allUsers = [];

// PHOTO VIEWER
const photoViewer = document.createElement("div");

photoViewer.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.96);
    z-index:99999;
    align-items:center;
    justify-content:center;
    padding:20px;
`;

const bigPhoto = document.createElement("img");

bigPhoto.style.cssText = `
    max-width:95%;
    max-height:85%;
    object-fit:contain;
`;

const closePhoto = document.createElement("button");
closePhoto.textContent = "✕";

closePhoto.style.cssText = `
    position:absolute;
    top:20px;
    right:22px;
    background:transparent;
    border:none;
    color:white;
    font-size:30px;
`;

photoViewer.append(bigPhoto, closePhoto);
document.body.appendChild(photoViewer);

function openPhoto(url) {
    bigPhoto.src = url;
    photoViewer.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function hidePhoto() {
    photoViewer.style.display = "none";
    bigPhoto.src = "";
    document.body.style.overflow = "";
}

closePhoto.addEventListener("click", hidePhoto);

photoViewer.addEventListener("click", event => {
    if (event.target === photoViewer) hidePhoto();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") hidePhoto();
});

// USER AVATAR
function createAvatar(user) {
    const avatar = document.createElement("div");
    avatar.className = "avatar";

    if (user.photoURL) {
        const image = document.createElement("img");

        image.src = user.photoURL;
        image.alt = "Profile Photo";

        image.style.cssText = `
            width:100%;
            height:100%;
            object-fit:cover;
            border-radius:50%;
        `;

        avatar.appendChild(image);
        avatar.style.cursor = "pointer";

        avatar.addEventListener("click", event => {
            event.stopPropagation();
            openPhoto(user.photoURL);
        });

    } else {
        avatar.textContent =
            (user.name || "U").trim().charAt(0).toUpperCase();
    }

    return avatar;
}

// DISPLAY USERS
function displayUsers(users) {
    usersList.replaceChildren();

    if (users.length === 0) {
        usersList.textContent = "No users found.";
        return;
    }

    users.forEach(user => {
        const item = document.createElement("div");
        item.className = "chat-item";

        item.addEventListener("click", () => {
            window.location.href =
                "chat.html?uid=" + encodeURIComponent(user.uid);
        });

        const avatar = createAvatar(user);

        const info = document.createElement("div");
        info.className = "chat-info";

        const name = document.createElement("h4");
        name.textContent = user.name || "Wazzup User";

        const username = document.createElement("p");
        username.textContent = "@" + (user.username || "user");

        info.append(name, username);

        const arrow = document.createElement("span");
        arrow.className = "chat-arrow";
        arrow.textContent = "›";

        item.append(avatar, info, arrow);
        usersList.appendChild(item);
    });
}

// SEARCH USERS
userSearch.addEventListener("input", () => {
    const searchText = userSearch.value.toLowerCase().trim();

    const filteredUsers = allUsers.filter(user => {
        const name = (user.name || "").toLowerCase();
        const username = (user.username || "").toLowerCase();

        return name.includes(searchText) ||
               username.includes(searchText);
    });

    displayUsers(filteredUsers);
});

// AUTH AND LOAD USERS
onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    try {
        usersList.textContent = "Loading users...";

        const snapshot = await getDocs(collection(db, "users"));

        allUsers = [];

        snapshot.forEach(userDoc => {
            const data = userDoc.data();

            if (userDoc.id !== user.uid) {
                allUsers.push({
                    ...data,
                    uid: userDoc.id
                });
            }
        });

        displayUsers(allUsers);

    } catch (error) {
        console.error(error);
        usersList.textContent =
            "Error loading users: " + error.message;
    }
});
