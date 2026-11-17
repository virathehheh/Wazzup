
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
    serverTimestamp,
    updateDoc
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
let unsubscribeMessages = null;

// TIME FORMAT
function formatTime(timestamp) {
    if (!timestamp) return "just now";

    const seconds = Math.floor(
        (Date.now() - timestamp.toDate().getTime()) / 1000
    );

    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return hours + (hours === 1 ? " hour ago" : " hours ago");
    }

    const days = Math.floor(hours / 24);

    return days + (days === 1 ? " day ago" : " days ago");
}

// DISPLAY MESSAGES
function displayMessages(snapshot) {

    messagesArea.innerHTML = "";

    if (snapshot.empty) {
        messagesArea.innerHTML =
            '<div class="empty-chat"><h3>Start a Conversation!</h3><p>Say hello to your friend.</p></div>';
        return;
    }

    snapshot.forEach(messageDoc => {

        const message = messageDoc.data();

        const isMine = message.senderId === currentUser.uid;

        const bubble = document.createElement("div");
        bubble.className = isMine ? "message-bubble sent" : "message-bubble received";

        const text = document.createElement("p");
        text.className = "message-text";
        text.textContent = message.text || "";

        const status = document.createElement("small");
        status.className = "message-status";
        status.dataset.sentAt = message.sentAt
            ? message.sentAt.toMillis()
            : "";

        status.dataset.readAt = message.readAt
            ? message.readAt.toMillis()
            : "";

        if (isMine) {
            status.textContent = message.readAt
                ? "Seen " + formatTime(message.readAt)
                : "Sent " + formatTime(message.sentAt);
        } else {
            status.textContent = formatTime(message.sentAt);
        }

        bubble.appendChild(text);
        bubble.appendChild(status);

        messagesArea.appendChild(bubble);
    });

    messagesArea.scrollTop = messagesArea.scrollHeight;

    // MARK RECEIVED MESSAGES AS READ
    snapshot.forEach(async messageDoc => {

        const message = messageDoc.data();

        if (
            message.senderId !== currentUser.uid &&
            !message.readAt
        ) {
            try {
                await updateDoc(
                    doc(db, "chats", chatId, "messages", messageDoc.id),
                    { readAt: serverTimestamp() }
                );
            } catch (error) {
                console.log("Read receipt error:", error.message);
            }
        }
    });
}

// LIVE MESSAGE LISTENER
function startChat() {

    const messagesRef = collection(db, "chats", chatId, "messages");

    const messagesQuery = query(
        messagesRef,
        orderBy("sentAt", "asc")
    );

    unsubscribeMessages = onSnapshot(
        messagesQuery,
        displayMessages,
        error => {
            messagesArea.textContent = "Chat error: " + error.message;
        }
    );
}

// SEND MESSAGE
sendButton.addEventListener("click", async function () {

    const messageText = messageInput.value.trim();

    if (!messageText || !currentUser || !chatId) return;

    sendButton.disabled = true;

    try {

        await addDoc(
            collection(db, "chats", chatId, "messages"),
            {
                senderId: currentUser.uid,
                text: messageText,
                sentAt: serverTimestamp(),
                readAt: null
            }
        );

        messageInput.value = "";

    } catch (error) {
        alert("Message not sent: " + error.message);
    }

    sendButton.disabled = false;
});

// SEND WITH ENTER
messageInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        sendButton.click();
    }
});

// UPDATE TIME LABELS
setInterval(() => {

    document.querySelectorAll(".message-status").forEach(status => {

        const sentAt = Number(status.dataset.sentAt);
        const readAt = Number(status.dataset.readAt);

        if (readAt) {
            status.textContent = "Seen " + formatTime({
                toDate: () => new Date(readAt)
            });
        } else if (sentAt) {
            const bubble = status.closest(".message-bubble");

            if (bubble && bubble.classList.contains("sent")) {
                status.textContent = "Sent " + formatTime({
                    toDate: () => new Date(sentAt)
                });
            } else {
                status.textContent = formatTime({
                    toDate: () => new Date(sentAt)
                });
            }
        }
    });

}, 15000);

// LOGIN AND CHAT SETUP
onAuthStateChanged(auth, async user => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    if (!recipientUid || recipientUid === currentUser.uid) {
        alert("Invalid chat user!");
        window.location.href = "home.html";
        return;
    }

    chatId = [currentUser.uid, recipientUid].sort().join("_");

    try {

        const userDoc = await getDoc(doc(db, "users", recipientUid));

        if (!userDoc.exists()) {
            alert("User not found!");
            window.location.href = "home.html";
            return;
        }

        const data = userDoc.data();

        document.getElementById("chatName").textContent =
            data.name || "Wazzup User";

        document.querySelector(".chat-avatar").textContent =
            (data.name || "U").charAt(0).toUpperCase();

        document.getElementById("chatStatus").textContent = "Wazzup";

        const chatRef = doc(db, "chats", chatId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
            await setDoc(chatRef, {
                participants: [currentUser.uid, recipientUid],
                createdAt: serverTimestamp()
            });
        }

        if (unsubscribeMessages) {
            unsubscribeMessages();
        }

        startChat();

    } catch (error) {
        messagesArea.textContent = "Error: " + error.message;
    }
});
