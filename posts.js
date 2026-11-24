
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

const firebaseConfig = {
    apiKey: "AIzaSyCmeHA37L-kwgt6FnrpqrXHvM7IjvsNVRs",
    authDomain: "wazzup-0021.firebaseapp.com",
    projectId: "wazzup-0021",
    storageBucket: "wazzup-0021.firebasestorage.app",
    messagingSenderId: "960018982217",
    appId: "1:960018982217:web:1a196e52060b2140a2e698"
};

const CLOUD_NAME = "bfhboa38";
const UPLOAD_PRESET = "wazzup_social";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const postCaption = document.getElementById("postCaption");
const postMedia = document.getElementById("postMedia");
const createPostBtn = document.getElementById("createPostBtn");
const postsFeed = document.getElementById("postsFeed");

let currentUser = null;
let unsubscribePosts = null;

// UPLOAD MEDIA
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

// CREATE POST
createPostBtn.addEventListener("click", async () => {
    if (!currentUser) return;

    const caption = postCaption.value.trim();
    const file = postMedia.files[0];

    if (!caption && !file) {
        alert("Write something or select a photo/video.");
        return;
    }

    if (file &&
        !file.type.startsWith("image/") &&
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
            mediaUrl,
            mediaType,
            caption,
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

// GET AUTHOR
async function getPostAuthor(uid) {
    const userSnap = await getDoc(doc(db, "users", uid));

    if (userSnap.exists()) {
        return userSnap.data();
    }

    return { name: "Wazzup User", photoURL: "" };
}

// PHOTO VIEWER
function openPhoto(url) {
    const viewer = document.createElement("div");

    viewer.style.cssText = `
        position:fixed;
        inset:0;
        z-index:99999;
        background:rgba(0,0,0,.97);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:15px;
    `;

    const image = document.createElement("img");
    image.src = url;

    image.style.cssText = `
        max-width:100%;
        max-height:90%;
        object-fit:contain;
    `;

    const close = document.createElement("button");
    close.textContent = "✕";

    close.style.cssText = `
        position:absolute;
        top:20px;
        right:20px;
        color:white;
        background:#222;
        border:0;
        border-radius:50%;
        padding:12px;
        font-size:20px;
    `;

    close.addEventListener("click", () => viewer.remove());

    viewer.addEventListener("click", event => {
        if (event.target === viewer) viewer.remove();
    });

    viewer.append(image, close);
    document.body.appendChild(viewer);
}

// LIKE / UNLIKE
async function toggleLike(postId, button) {
    const likeRef = doc(
        db, "posts", postId, "likes", currentUser.uid
    );

    button.disabled = true;

    try {
        const existing = await getDoc(likeRef);

        if (existing.exists()) {
            await deleteDoc(likeRef);
        } else {
            await setDoc(likeRef, {
                userId: currentUser.uid,
                createdAt: serverTimestamp()
            });
        }

    } catch (error) {
        alert("Like error: " + error.message);
    } finally {
        button.disabled = false;
    }
}

// ADD COMMENT
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

// DELETE POST
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

// SHARE POST
async function sharePost(postId) {
    const shareURL =
        window.location.origin +
        window.location.pathname.replace("posts.html", "posts.html") +
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

// DISPLAY POSTS
async function displayPosts(snapshot) {
    postsFeed.replaceChildren();

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

            // AUTHOR HEADER
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
                flex-shrink:0;
            `;

            if (author.photoURL) {
                const img = document.createElement("img");
                img.src = author.photoURL;
                img.style.cssText =
                    "width:100%;height:100%;object-fit:cover;";
                avatar.appendChild(img);
            } else {
                avatar.textContent =
                    (author.name || "U").charAt(0).toUpperCase();
            }

            const name = document.createElement("strong");
            name.className = "post-author";
            name.textContent = author.name || "Wazzup User";

            const authorInfo = document.createElement("div");
            authorInfo.appendChild(name);

            header.append(avatar, authorInfo);

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
                card.appendChild(caption);
            }

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

                    media.addEventListener("click", () => {
                        openPhoto(post.mediaUrl);
                    });
                }

                media.src = post.mediaUrl;
                media.className = "post-media";
                card.appendChild(media);
            }

            // LIKE DATA
            const likesRef = collection(
                db, "posts", postId, "likes"
            );

            const likesSnapshot = await getDocs(likesRef);

            const myLike = await getDoc(
                doc(db, "posts", postId, "likes", currentUser.uid)
            );

            const actions = document.createElement("div");
            actions.className = "post-actions";

            const likeButton = document.createElement("button");

            likeButton.textContent =
                (myLike.exists() ? "❤️" : "🤍") +
                " Like (" + likesSnapshot.size + ")";

            likeButton.addEventListener("click", async () => {
                await toggleLike(postId, likeButton);
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

            actions.append(likeButton, commentButton, shareButton);
            card.appendChild(actions);

            // COMMENTS
            const commentsSnapshot = await getDocs(
                collection(db, "posts", postId, "comments")
            );

            const heading = document.createElement("p");
            heading.textContent =
                "Comments (" + commentsSnapshot.size + ")";
            heading.style.fontWeight = "bold";

            card.appendChild(heading);

            commentsSnapshot.forEach(commentDoc => {
                const comment = commentDoc.data();
                const line = document.createElement("p");

                line.className = "post-comment";
                line.textContent =
                    (comment.userId === currentUser.uid
                        ? "You"
                        : "User") + ": " + comment.text;

                card.appendChild(line);
            });

            postsFeed.appendChild(card);

        } catch (error) {
            console.error("Post display error:", error);
        }
    }
}

// LIVE POSTS
function startPostsListener() {
    const postsQuery = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc")
    );

    unsubscribePosts = onSnapshot(
        postsQuery,
        snapshot => displayPosts(snapshot),
        error => {
            postsFeed.textContent =
                "Error loading posts: " + error.message;
        }
    );
}

// AUTH
onAuthStateChanged(auth, user => {
    if (!user) {
        if (unsubscribePosts) unsubscribePosts();
        window.location.href = "index.html";
        return;
    }

    currentUser = user;
    startPostsListener();
});
