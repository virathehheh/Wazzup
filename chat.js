
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    updateDoc,
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const messagesArea = document.getElementById("messagesArea");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const chatName = document.getElementById("chatName");
const chatStatus = document.getElementById("chatStatus");
const chatAvatar = document.querySelector(".chat-avatar");

let currentUser = null;
let recipientId = null;
let recipientPresence = null;
let messageElements = new Map();
let unsubscribeMessages = null;
let unsubscribePresence = null;
let presenceInterval = null;

let recipientPhotoURL = null;

// =====================================
// FULL SCREEN PHOTO VIEWER
// =====================================

const photoViewer = document.createElement("div");

photoViewer.style.cssText = `
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.95);
    z-index: 99999;
    align-items: center;
    justify-content: center;
    padding: 20px;
`;

const bigPhoto = document.createElement("img");

bigPhoto.style.cssText = `
    max-width: 95%;
    max-height: 85%;
    object-fit: contain;
    border-radius: 10px;
`;

const closePhoto = document.createElement("button");

closePhoto.textContent = "✕";

closePhoto.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    width: auto;
    color: white;
    background: transparent;
    font-size: 30px;
    cursor: pointer;
`;

photoViewer.appendChild(bigPhoto);
photoViewer.appendChild(closePhoto);
document.body.appendChild(photoViewer);

function openBigPhoto(url) {
    if (!url) return;

    bigPhoto.src = url;
    photoViewer.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeBigPhoto() {
    photoViewer.style.display = "none";
    bigPhoto.src = "";
    document.body.style.overflow = "";
}

closePhoto.addEventListener("click", closeBigPhoto);

photoViewer.addEventListener("click", (event) => {
    if (event.target === photoViewer) {
        closeBigPhoto();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeBigPhoto();
    }
});

// =====================================
// RECIPIENT DETAILS
// =====================================

const params = new URLSearchParams(window.location.search);
recipientId = params.get("uid");

if (!recipientId) {
    alert("User not found!");
}

// =====================================
// AUTH CHECK
// =====================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    if (!recipientId || recipientId === currentUser.uid) {
        alert("Invalid chat user!");
        window.location.href = "home.html";
        return;
    }

    await loadRecipient();

    startMyPresence();
    listenToRecipientPresence();
    loadMessages();
});

// =====================================
// LOAD RECIPIENT
// =====================================

async function loadRecipient() {

    try {

        const userRef = doc(db, "users", recipientId);
        const snap = await getDoc(userRef);

        if (snap.exists()) {

            const data = snap.data();

            chatName.textContent =
                data.name || data.username || "Wazzup User";

            if (chatAvatar) {

                chatAvatar.replaceChildren();

                if (data.photoURL) {

                    recipientPhotoURL = data.photoURL;

                    const image = document.createElement("img");

                    image.src = data.photoURL;
                    image.alt = "Profile Photo";

                    image.style.width = "100%";
                    image.style.height = "100%";
                    image.style.objectFit = "cover";
                    image.style.borderRadius = "50%";

                    chatAvatar.appendChild(image);
                    chatAvatar.style.cursor = "pointer";

                    chatAvatar.onclick = () => {
                        openBigPhoto(recipientPhotoURL);
                    };

                } else {

                    recipientPhotoURL = null;

                    chatAvatar.textContent =
                        (data.name || "U").charAt(0).toUpperCase();

                    chatAvatar.onclick = null;
                    chatAvatar.style.cursor = "default";
                }
            }
        }

    } catch (error) {

        console.error("Recipient error:", error);

    }
}

// =====================================
// MY ONLINE / LAST SEEN
// =====================================

async function updateMyPresence(isOnline) {

    if (!currentUser) return;

    try {

        await setDoc(
            doc(db, "users", currentUser.uid),
            {
                isOnline: isOnline,
                lastSeen: serverTimestamp()
            },
            { merge: true }
        );

    } catch (error) {

        console.error("Presence update error:", error);

    }
}

function startMyPresence() {

    updateMyPresence(true);

    if (presenceInterval) {
        clearInterval(presenceInterval);
    }

    presenceInterval = setInterval(() => {

        if (document.visibilityState === "visible") {
            updateMyPresence(true);
        }

    }, 30000);

    document.addEventListener("visibilitychange", () => {

        updateMyPresence(
            document.visibilityState === "visible"
        );

    });

    window.addEventListener("pagehide", () => {
        updateMyPresence(false);
    });
}

// =====================================
// RECIPIENT ONLINE / LAST SEEN
// =====================================

function listenToRecipientPresence() {

    const recipientRef = doc(db, "users", recipientId);

    unsubscribePresence = onSnapshot(
        recipientRef,

        (snapshot) => {

            if (snapshot.exists()) {
                recipientPresence = snapshot.data();
            } else {
                recipientPresence = null;
            }

            showRecipientPresence();

        },

        (error) => {
            console.error("Presence listener error:", error);
        }
    );
}

function showRecipientPresence() {

    if (!chatStatus) return;

    if (!recipientPresence) {
        chatStatus.textContent = "Offline";
        return;
    }

    const lastSeen = recipientPresence.lastSeen;
    let recent = false;

    if (lastSeen && typeof lastSeen.toDate === "function") {

        recent =
            Date.now() - lastSeen.toDate().getTime() < 70000;

    }

    if (recipientPresence.isOnline && recent) {

        chatStatus.textContent = "Online";

    } else if (lastSeen) {

        chatStatus.textContent =
            "Last seen " + formatTime(lastSeen);

    } else {

        chatStatus.textContent = "Offline";

    }
}

// =====================================
// TIME FORMAT
// =====================================

function formatTime(timestamp) {

    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "just now";
    }

    const time = timestamp.toDate();

    const seconds = Math.floor(
        (Date.now() - time.getTime()) / 1000
    );

    if (seconds < 60) {
        return "just now";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {

        return minutes +
            (minutes === 1 ? " minute ago" : " minutes ago");

    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {

        return hours +
            (hours === 1 ? " hour ago" : " hours ago");

    }

    const days = Math.floor(hours / 24);

    if (days < 7) {

        return days +
            (days === 1 ? " day ago" : " days ago");

    }

    return time.toLocaleDateString();
}

// =====================================
// CHAT ID
// =====================================

function getChatId() {

    return [currentUser.uid, recipientId]
        .sort()
        .join("_");

}

// =====================================
// LOAD MESSAGES
// =====================================

async function loadMessages() {

    const chatId = getChatId();
    const chatRef = doc(db, "chats", chatId);

    try {

        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {

            await setDoc(chatRef, {
                participants: [currentUser.uid, recipientId],
                createdAt: serverTimestamp()
            });

        }

        const messagesRef = collection(
            db,
            "chats",
            chatId,
            "messages"
        );

        const q = query(
            messagesRef,
            orderBy("sentAt", "asc")
        );

        unsubscribeMessages = onSnapshot(q, (snapshot) => {

            snapshot.docChanges().forEach((change) => {

                const messageId = change.doc.id;
                const message = change.doc.data();

                if (change.type === "added") {
                    createMessage(messageId, message);
                }

                if (change.type === "modified") {
                    updateMessage(messageId, message);
                }

            });

            markMessagesAsRead(snapshot);

        });

    } catch (error) {

        console.error("Messages error:", error);

    }
}

// =====================================
// CREATE MESSAGE ELEMENT
// =====================================

function createMessage(messageId, message) {

    if (messageElements.has(messageId)) return;

    const isSent = message.senderId === currentUser.uid;

    const bubble = document.createElement("div");

    bubble.className = isSent
        ? "message sent"
        : "message received";

    bubble.style.backgroundColor = isSent
        ? "#38bdf8"
        : "#262626";

    bubble.style.color = isSent
        ? "#071827"
        : "#ffffff";

    bubble.style.display = "flex";
    bubble.style.flexDirection = "column";
    bubble.style.width = "fit-content";
    bubble.style.maxWidth = "75%";
    bubble.style.padding = "12px 16px";
    bubble.style.margin = "8px 12px";
    bubble.style.borderRadius = "20px";
    bubble.style.boxSizing = "border-box";
    bubble.style.overflowWrap = "anywhere";
    bubble.style.textAlign = "left";

    // MESSAGE TEXT
    const text = document.createElement("p");

    text.textContent = message.text || "";

    text.style.color = isSent
        ? "#071827"
        : "#ffffff";

    text.style.fontWeight = "bold";
    text.style.margin = "0";
    text.style.padding = "0";
    text.style.fontSize = "16px";
    text.style.lineHeight = "1.4";
    text.style.textAlign = "left";

    // MESSAGE STATUS
    const status = document.createElement("small");

    status.className = "message-status";

    status.style.color = isSent
        ? "#071827"
        : "#ffffff";

    status.style.fontSize = "11px";
    status.style.fontWeight = "bold";
    status.style.marginTop = "6px";
    status.style.alignSelf = "flex-end";
    status.style.opacity = "0.8";

    bubble.appendChild(text);
    bubble.appendChild(status);

    // MESSAGE POSITION
    if (isSent) {

        bubble.style.alignSelf = "flex-end";
        bubble.style.marginLeft = "auto";
        bubble.style.borderBottomRightRadius = "5px";

    } else {

        bubble.style.alignSelf = "flex-start";
        bubble.style.marginRight = "auto";
        bubble.style.borderBottomLeftRadius = "5px";

    }

    messagesArea.appendChild(bubble);

    messageElements.set(messageId, {
        bubble,
        status,
        message
    });

    updateMessage(messageId, message);

    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// =====================================
// UPDATE MESSAGE STATUS
// =====================================

function updateMessage(messageId, message) {

    const item = messageElements.get(messageId);

    if (!item) return;

    item.message = message;

    if (message.senderId === currentUser.uid) {

        if (message.readAt) {

            item.status.textContent =
                "Seen " + formatTime(message.readAt);

        } else {

            item.status.textContent =
                "Sent " + formatTime(message.sentAt);

        }

    } else {

        item.status.textContent =
            formatTime(message.sentAt);

    }
}

// =====================================
// MARK RECEIVED MESSAGES AS READ
// =====================================

async function markMessagesAsRead(snapshot) {

    const chatId = getChatId();

    for (const messageDoc of snapshot.docs) {

        const message = messageDoc.data();

        if (
            message.senderId !== currentUser.uid &&
            !message.readAt
        ) {

            try {

                await updateDoc(
                    doc(
                        db,
                        "chats",
                        chatId,
                        "messages",
                        messageDoc.id
                    ),
                    {
                        readAt: serverTimestamp()
                    }
                );

            } catch (error) {

                console.error("Read receipt error:", error);

            }
        }
    }
}

// =====================================
// SEND MESSAGE
// =====================================

sendButton.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        sendMessage();
    }

});

async function sendMessage() {

    const text = messageInput.value.trim();

    if (!text || !currentUser || !recipientId) return;

    sendButton.disabled = true;

    try {

        const chatId = getChatId();

        const messagesRef = collection(
            db,
            "chats",
            chatId,
            "messages"
        );

        await addDoc(messagesRef, {

            text: text,
            senderId: currentUser.uid,
            sentAt: serverTimestamp(),
            readAt: null

        });

        messageInput.value = "";

    } catch (error) {

        console.error("Send message error:", error);

        alert("Message send nahi hua. Dobara try karo.");

    } finally {

        sendButton.disabled = false;

    }
}

// =====================================
// CLEANUP
// =====================================

window.addEventListener("beforeunload", () => {

    if (presenceInterval) {
        clearInterval(presenceInterval);
    }

    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    if (unsubscribePresence) {
        unsubscribePresence();
    }

});
