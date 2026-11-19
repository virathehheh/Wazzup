
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
    updateDoc,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    deleteDoc
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

const myPostsFeed = document.getElementById("myPostsFeed");

let currentUser = null;
let userData = {};

// AUTH
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
        loadMyPosts();

    } catch (error) {
        alert("Profile loading failed: " + error.message);
    }
});

// SHOW PROFILE
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

// CLEAN IMAGE
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

// OPEN GALLERY
uploadPhotoButton.addEventListener("click", () => {
    photoInput.click();
});

// UPLOAD PROFILE PHOTO
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

        await updateDoc(doc(db, "users", currentUser.uid), {
            photoURL: photoURL
        });

        userData.photoURL = photoURL;
        showProfile(currentUser);

        alert("Profile photo uploaded successfully!");

    } catch (error) {
        alert("Photo upload failed: " + error.message);

    } finally {
        uploadPhotoButton.disabled = false;
        uploadPhotoButton.textContent = "Upload Profile Photo";
        photoInput.value = "";
    }
});

// EDIT PROFILE
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
        await updateDoc(doc(db, "users", currentUser.uid), {
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

// LOAD MY POSTS
async function loadMyPosts() {
    if (!currentUser) return;

    myPostsFeed.textContent = "Loading your posts...";

    try {
        const postsQuery = query(
            collection(db, "posts"),
            where("ownerId", "==", currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(postsQuery);

        myPostsFeed.replaceChildren();

        if (snapshot.empty) {
            myPostsFeed.textContent = "You haven't shared any posts yet.";
            return;
        }

        for (const postDoc of snapshot.docs) {
            const post = postDoc.data();
            const postId = postDoc.id;

            const card = document.createElement("div");
            card.className = "post-card";

            // AUTHOR
            const author = document.createElement("h3");
            author.textContent = userData.name || "You";
            card.appendChild(author);

            // MEDIA
            if (post.mediaUrl) {
                let media;

                if (post.mediaType === "video") {
                    media = document.createElement("video");
                    media.controls = true;
                    media.playsInline = true;
                } else {
                    media = document.createElement("img");
                    media.alt = "Post image";
                }

                media.src = post.mediaUrl;
                media.style.width = "100%";
                media.style.maxHeight = "400px";
                media.style.objectFit = "contain";
                media.style.borderRadius = "12px";

                card.appendChild(media);
            }

            // CAPTION
            if (post.caption) {
                const caption = document.createElement("p");
                caption.textContent = post.caption;
                card.appendChild(caption);
            }

            // LIKE COUNT
            const likesText = document.createElement("p");
            likesText.textContent = "Loading likes...";

            card.appendChild(likesText);

            try {
                const likesSnapshot = await getDocs(
                    collection(db, "posts", postId, "likes")
                );

                likesText.textContent =
                    "❤️ " + likesSnapshot.size + " Likes";

            } catch (error) {
                likesText.textContent = "❤️ Likes unavailable";
            }

            // DELETE BUTTON
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.textContent = "Delete Post";

            deleteButton.addEventListener("click", async () => {
                const confirmed = confirm(
                    "Are you sure you want to delete this post?"
                );

                if (!confirmed) return;

                deleteButton.disabled = true;
                deleteButton.textContent = "Deleting...";

                try {
                    await deleteDoc(doc(db, "posts", postId));

                    alert("Post deleted successfully!");

                    loadMyPosts();

                } catch (error) {
                    alert("Delete failed: " + error.message);
                    deleteButton.disabled = false;
                    deleteButton.textContent = "Delete Post";
                }
            });

            card.appendChild(deleteButton);

            myPostsFeed.appendChild(card);
        }

    } catch (error) {
        console.error(error);

        myPostsFeed.textContent =
            "Unable to load posts: " + error.message;
    }
}

// LOGOUT
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
