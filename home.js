
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    setDoc,
    deleteDoc,
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

// CLOUDINARY SETTINGS
const CLOUD_NAME = "bfhboa38";
const UPLOAD_PRESET = "wazzup_social";

// ELEMENTS
const usersList = document.getElementById("usersList");
const userSearch = document.getElementById("userSearch");
const postCaption = document.getElementById("postCaption");
const postMedia = document.getElementById("postMedia");
const createPostBtn = document.getElementById("createPostBtn");
const postsFeed = document.getElementById("postsFeed");

let allUsers = [];
let currentUser = null;
let unsubscribePosts = null;

// ==============================
// PHOTO VIEWER
// ==============================

const photoViewer = document.createElement("div");

photoViewer.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    background:rgba(0,0,0,0.94);
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
    border-radius:8px;
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

photoViewer.appendChild(bigPhoto);
photoViewer.appendChild(closePhoto);
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

// ==============================
// USER AVATAR
// ==============================

function createAvatar(user) {
    const avatar = document.createElement("div");
    avatar.className = "avatar";

    if (user.photoURL) {
        const image = document.createElement("img");

        image.src = user.photoURL;
        image.alt = (user.name || "User") + " profile photo";

        image.style.width = "100%";
        image.style.height = "100%";
        image.style.objectFit = "cover";
        image.style.borderRadius = "50%";

        avatar.appendChild(image);
        avatar.style.cursor = "pointer";

        avatar.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            openPhoto(user.photoURL);
        });

    } else {
        avatar.textContent =
            (user.name || "U").trim().charAt(0).toUpperCase();
    }

    return avatar;
}

// ==============================
// DISPLAY USERS
// ==============================

function displayUsers(users) {
    usersList.innerHTML = "";

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

        info.appendChild(name);
        info.appendChild(username);

        const arrow = document.createElement("span");
        arrow.className = "chat-arrow";
        arrow.textContent = "›";

        item.appendChild(avatar);
        item.appendChild(info);
        item.appendChild(arrow);

        usersList.appendChild(item);
    });
}

// ==============================
// SEARCH USERS
// ==============================

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

// ==============================
// CLOUDINARY UPLOAD
// ==============================

async function uploadToCloudinary(file) {

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.error?.message || "Media upload failed."
        );
    }

    return result.secure_url;
}

// ==============================
// CREATE POST
// ==============================

createPostBtn.addEventListener("click", async () => {

    if (!currentUser) {
        alert("Please login first.");
        return;
    }

    const caption = postCaption.value.trim();
    const file = postMedia.files[0];

    if (!caption && !file) {
        alert("Write something or select a photo/video.");
        return;
    }

    if (file && !file.type.startsWith("image/") &&
        !file.type.startsWith("video/")) {
        alert("Only images and videos are allowed.");
        return;
    }

    createPostBtn.disabled = true;
    createPostBtn.textContent = "Uploading...";

    try {

        let mediaUrl = "";
        let mediaType = "";

        if (file) {
            mediaUrl = await uploadToCloudinary(file);
            mediaType = file.type.startsWith("video/")
                ? "video"
                : "image";
        }

        await addDoc(collection(db, "posts"), {
            ownerId: currentUser.uid,
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            caption: caption,
            createdAt: serverTimestamp()
        });

        postCaption.value = "";
        postMedia.value = "";

        alert("Your post has been shared!");

    } catch (error) {

        alert("Post error: " + error.message);

    } finally {

        createPostBtn.disabled = false;
        createPostBtn.textContent = "Share Post";

    }
});

// ==============================
// LOAD POST AUTHOR
// ==============================

async function getPostAuthor(uid) {

    const userDoc = await getDoc(doc(db, "users", uid));

    if (userDoc.exists()) {
        return userDoc.data();
    }

    return {
        name: "Wazzup User",
        photoURL: ""
    };
}

// ==============================
// LIKE / UNLIKE
// ==============================

async function toggleLike(postId) {

    const likeRef = doc(
        db,
        "posts",
        postId,
        "likes",
        currentUser.uid
    );

    try {

        const existingLike = await getDoc(likeRef);

        if (existingLike.exists()) {

            await deleteDoc(likeRef);

        } else {

            await setDoc(likeRef, {
                userId: currentUser.uid,
                createdAt: serverTimestamp()
            });

        }

    } catch (error) {

        alert("Like error: " + error.message);

    }
}

// ==============================
// ADD COMMENT
// ==============================

async function addComment(postId) {

    const text = prompt("Write your comment:");

    if (!text || !text.trim()) return;

    if (text.trim().length > 1000) {
        alert("Comment is too long.");
        return;
    }

    try {

        await addDoc(
            collection(db, "posts", postId, "comments"),
            {
                userId: currentUser.uid,
                text: text.trim(),
                createdAt: serverTimestamp()
            }
        );

    } catch (error) {

        alert("Comment error: " + error.message);

    }
}

// ==============================
// DELETE POST
// ==============================

async function deletePost(postId) {

    if (!confirm("Are you sure you want to delete this post?")) {
        return;
    }

    try {

        await deleteDoc(doc(db, "posts", postId));

        alert("Post deleted.");

    } catch (error) {

        alert("Delete error: " + error.message);

    }
}

// ==============================
// SHARE POST
// ==============================

async function sharePost(postId) {

    const shareURL =
        window.location.origin +
        window.location.pathname +
        "?post=" + encodeURIComponent(postId);

    try {

        if (navigator.share) {

            await navigator.share({
                title: "Wazzup Post",
                text: "Check out this post on Wazzup!",
                url: shareURL
            });

        } else {

            await navigator.clipboard.writeText(shareURL);
            alert("Post link copied!");

        }

    } catch (error) {

        if (error.name !== "AbortError") {
            alert("Unable to share this post.");
        }

    }
}

// ==============================
// DISPLAY POSTS
// ==============================

async function displayPosts(snapshot) {

    postsFeed.innerHTML = "";

    if (snapshot.empty) {
        postsFeed.textContent =
            "No posts yet. Be the first to post!";
        return;
    }

    for (const postDocument of snapshot.docs) {

        const post = postDocument.data();
        const postId = postDocument.id;

        try {

            const author = await getPostAuthor(post.ownerId);

            const card = document.createElement("div");
            card.className = "wazzup-post";

            card.style.cssText = `
                background:#fff;
                color:#222;
                border-radius:12px;
                padding:14px;
                margin:15px 0;
                box-shadow:0 2px 10px rgba(0,0,0,0.08);
            `;

            // AUTHOR
            const header = document.createElement("div");

            header.style.cssText = `
                display:flex;
                align-items:center;
                gap:10px;
                margin-bottom:12px;
            `;

            const avatar = document.createElement("div");

            avatar.style.cssText = `
                width:42px;
                height:42px;
                border-radius:50%;
                overflow:hidden;
                background:#263747;
                color:white;
                display:flex;
                align-items:center;
                justify-content:center;
                font-weight:bold;
                flex-shrink:0;
            `;

            if (author.photoURL) {

                const image = document.createElement("img");

                image.src = author.photoURL;
                image.style.width = "100%";
                image.style.height = "100%";
                image.style.objectFit = "cover";

                avatar.appendChild(image);

            } else {

                avatar.textContent =
                    (author.name || "U").charAt(0).toUpperCase();

            }

            const authorName = document.createElement("strong");
            authorName.textContent = author.name || "Wazzup User";

            const authorInfo = document.createElement("div");
            authorInfo.appendChild(authorName);

            header.appendChild(avatar);
            header.appendChild(authorInfo);

            // DELETE BUTTON
            if (post.ownerId === currentUser.uid) {

                const deleteButton = document.createElement("button");

                deleteButton.textContent = "Delete";
                deleteButton.style.marginLeft = "auto";

                deleteButton.addEventListener("click", () => {
                    deletePost(postId);
                });

                header.appendChild(deleteButton);
            }

            card.appendChild(header);

            // CAPTION
            if (post.caption) {

                const caption = document.createElement("p");

                caption.textContent = post.caption;
                caption.style.margin = "10px 0";

                card.appendChild(caption);
            }

            // MEDIA
            if (post.mediaUrl) {

                if (post.mediaType === "video") {

                    const video = document.createElement("video");

                    video.src = post.mediaUrl;
                    video.controls = true;
                    video.playsInline = true;

                    video.style.cssText = `
                        width:100%;
                        max-height:450px;
                        border-radius:10px;
                        background:#000;
                    `;

                    card.appendChild(video);

                } else {

                    const image = document.createElement("img");

                    image.src = post.mediaUrl;
                    image.alt = "Post image";

                    image.style.cssText = `
                        width:100%;
                        max-height:450px;
                        object-fit:contain;
                        border-radius:10px;
                        cursor:pointer;
                    `;

                    image.addEventListener("click", () => {
                        openPhoto(post.mediaUrl);
                    });

                    card.appendChild(image);
                }
            }

            // LIKE AND SHARE BUTTONS
            const likesRef = collection(
                db,
                "posts",
                postId,
                "likes"
            );

            const likesSnapshot = await getDocs(likesRef);

            const currentLike = await getDoc(
                doc(db, "posts", postId, "likes", currentUser.uid)
            );

            const actions = document.createElement("div");

            actions.style.cssText = `
                display:flex;
                align-items:center;
                gap:18px;
                margin-top:12px;
                flex-wrap:wrap;
            `;

            const likeButton = document.createElement("button");

            likeButton.textContent =
                (currentLike.exists() ? "❤️ " : "🤍 ") +
                "Like (" + likesSnapshot.size + ")";

            likeButton.addEventListener("click", () => {
                toggleLike(postId);
            });

            const commentButton = document.createElement("button");

            commentButton.textContent = "💬 Comment";

            commentButton.addEventListener("click", () => {
                addComment(postId);
            });

            const shareButton = document.createElement("button");

            shareButton.textContent = "↗ Share";

            shareButton.addEventListener("click", () => {
                sharePost(postId);
            });

            actions.appendChild(likeButton);
            actions.appendChild(commentButton);
            actions.appendChild(shareButton);

            card.appendChild(actions);

            // COMMENTS
            const commentsRef = collection(
                db,
                "posts",
                postId,
                "comments"
            );

            const commentsSnapshot = await getDocs(commentsRef);

            const commentsHeading = document.createElement("p");

            commentsHeading.textContent =
                "Comments (" + commentsSnapshot.size + ")";

            commentsHeading.style.cssText = `
                font-weight:bold;
                margin-top:14px;
            `;

            card.appendChild(commentsHeading);

            commentsSnapshot.forEach(commentDocument => {

                const comment = commentDocument.data();

                const commentLine = document.createElement("p");

                commentLine.textContent =
                    (comment.userId === currentUser.uid
                        ? "You"
                        : "User") +
                    ": " + comment.text;

                commentLine.style.cssText = `
                    font-size:14px;
                    margin:7px 0;
                    overflow-wrap:anywhere;
                `;

                card.appendChild(commentLine);
            });

            postsFeed.appendChild(card);

        } catch (error) {

            console.error("Post display error:", error);

        }
    }
}

// ==============================
// LOAD POSTS LIVE
// ==============================

function startPostsListener() {

    const postsQuery = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc")
    );

    unsubscribePosts = onSnapshot(
        postsQuery,
        snapshot => {
            displayPosts(snapshot);
        },
        error => {
            postsFeed.textContent =
                "Error loading posts: " + error.message;
        }
    );
}

// ==============================
// AUTHENTICATION AND LOAD USERS
// ==============================

onAuthStateChanged(auth, async user => {

    if (!user) {

        if (unsubscribePosts) unsubscribePosts();

        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    try {

        usersList.textContent = "Loading users...";

        const snapshot = await getDocs(collection(db, "users"));

        allUsers = [];

        snapshot.forEach(document => {

            const userData = document.data();

            if (document.id !== user.uid) {

                allUsers.push({
                    ...userData,
                    uid: document.id
                });

            }
        });

        displayUsers(allUsers);

        startPostsListener();

    } catch (error) {

        usersList.textContent =
            "Error loading users: " + error.message;

        console.error(error);

    }
});
