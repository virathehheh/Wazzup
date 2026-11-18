
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

const CLOUD_NAME = "bfhboa38";
const UPLOAD_PRESET = "wazzup_profile";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const profileName = document.getElementById("profileName");
const profileUsername = document.getElementById("profileUsername");
const profileAvatar = document.getElementById("profileAvatar");

const detailName = document.getElementById("detailName");
const detailUsername = document.getElementById("detailUsername");
const detailEmail = document.getElementById("detailEmail");
const detailBio = document.getElementById("detailBio");

const editButton = document.getElementById("editProfileButton");
const logoutButton = document.getElementById("logoutButton");

const photoInput = document.getElementById("photoInput");
const uploadPhotoButton = document.getElementById("uploadPhotoButton");

let currentUser = null;
let userData = {};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            userData = userSnap.data();
        }

        showProfile(user);

    } catch (error) {
        alert("Profile loading failed: " + error.message);
    }
});

function showProfile(user) {
    const name = userData.name || "User";
    const username = userData.username || "username";
    const email = userData.email || user.email || "Not available";
    const bio = userData.bio || "No bio added";

    profileName.textContent = name;
    profileUsername.textContent = "@" + username;

    detailName.textContent = name;
    detailUsername.textContent = "@" + username;
    detailEmail.textContent = email;
    detailBio.textContent = bio;

    profileAvatar.replaceChildren();

    if (userData.photoURL) {
        const image = document.createElement("img");
        image.src = userData.photoURL;
        image.alt = "Profile Photo";

        image.style.width = "100%";
        image.style.height = "100%";
        image.style.objectFit = "cover";
        image.style.borderRadius = "50%";

        profileAvatar.appendChild(image);
    } else {
        profileAvatar.textContent = name.charAt(0).toUpperCase();
    }
}

// Remove image metadata by re-encoding through canvas
function cleanImage(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectURL = URL.createObjectURL(file);

        image.onload = () => {
            const canvas = document.createElement("canvas");

            const maxSize = 1200;
            const scale = Math.min(
                1,
                maxSize / Math.max(image.width, image.height)
            );

            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);

            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                URL.revokeObjectURL(objectURL);

                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Image processing failed."));
                }
            }, "image/jpeg", 0.88);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectURL);
            reject(new Error("Unable to read this image."));
        };

        image.src = objectURL;
    });
}

// Open gallery
uploadPhotoButton.addEventListener("click", () => {
    photoInput.click();
});

// Upload selected photo
photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];

    if (!file || !currentUser) return;

    if (!file.type.startsWith("image/")) {
        alert("Please select an image.");
        photoInput.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert("Photo must be smaller than 5 MB.");
        photoInput.value = "";
        return;
    }

    uploadPhotoButton.disabled = true;
    uploadPhotoButton.textContent = "Uploading...";

    try {
        const cleanedImage = await cleanImage(file);

        const formData = new FormData();
        formData.append("file", cleanedImage, "profile.jpg");
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", "wazzup_profiles");

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
            {
                method: "POST",
                body: formData
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error?.message || "Cloudinary upload failed."
            );
        }

        const photoURL = result.secure_url;

        const userRef = doc(db, "users", currentUser.uid);

        await updateDoc(userRef, {
            photoURL: photoURL
        });

        userData.photoURL = photoURL;
        showProfile(currentUser);

        alert("Profile photo uploaded successfully!");

    } catch (error) {
        console.error(error);
        alert("Photo upload failed: " + error.message);

    } finally {
        uploadPhotoButton.disabled = false;
        uploadPhotoButton.textContent = "Upload Profile Photo";
        photoInput.value = "";
    }
});

// Edit profile
editButton.addEventListener("click", async () => {
    if (!currentUser) return;

    const newName = prompt(
        "Enter your full name:",
        userData.name || ""
    );

    if (newName === null) return;

    const newUsername = prompt(
        "Enter your username:",
        userData.username || ""
    );

    if (newUsername === null) return;

    const newBio = prompt(
        "Enter your bio:",
        userData.bio || ""
    );

    if (newBio === null) return;

    if (!newName.trim() || !newUsername.trim()) {
        alert("Name and username cannot be empty.");
        return;
    }

    try {
        const userRef = doc(db, "users", currentUser.uid);

        await updateDoc(userRef, {
            name: newName.trim(),
            username: newUsername.trim(),
            bio: newBio.trim()
        });

        userData.name = newName.trim();
        userData.username = newUsername.trim();
        userData.bio = newBio.trim();

        showProfile(currentUser);

        alert("Profile updated successfully!");

    } catch (error) {
        alert("Update failed: " + error.message);
    }
});

// Logout
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
