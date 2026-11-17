
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

const messageElements = new Map();
const readRequests = new Set();

// TIME FORMAT
function formatTime(value) {
    if (!value) return "just now";

    const date = value.toDate
        ? value.toDate()
        : new Date(value);

    if (isNaN(date.getTime())) return "just now";

    const seconds = Math.max(
        0,
        Math.floor((Date.now() - date.getTime()) / 1000)
    );

    if (seconds < 60) return "just now";

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

    return days +
        (days === 1 ? " day ago" : " days ago");
}

// CREATE MESSAGE ELEMENT
function createMessageElement(message, id) {
    const isMine = message.senderId === currentUser.uid;

    const bubble = document.createElement("div");
    bubble.className = isMine
        ? "message-bubble sent"
        : "message-bubble received";

    const text = document.createElement("p");
    text.className = "message-text";
    text.textContent = message.text || "";

    const status = document.createElement("small");
    status.className = "message-status";

    bubble.appendChild(text);
    bubble.appendChild(status);

    messageElements.set(id, {
        bubble,
        text,
        status
    });

    return bubble;
}

// UPDATE MESSAGE
function updateMessageElement(message, id) {
    let elements = messageElements.get(id);

    if (!elements) {
        createMessageElement(message, id);
        elements = messageElements.get(id);
    }

    const sentAt = message.sentAt || null;
    const readAt = message.readAt || null;

    elements.text.textContent = message.text || "";

    elements.status.dataset.sentAt = sentAt
        ? sentAt.toMillis()
        : "";

    elements.status.dataset.readAt = readAt
        ? readAt.toMillis()
        : "";

    const isMine = message.senderId === currentUser.uid;

    if (isMine) {
        elements.status.textContent = readAt
            ? "Seen " + formatTime(readAt)
            : "Sent " + formatTime(sentAt);
    } else {
        elements.status.textContent = formatTime(sentAt);
    }
}

// DISPLAY MESSAGES
function displayMessages(snapshot) {
    const wasNearBottom =
        messagesArea.scrollHeight -
        messagesArea.scrollTop -
        messagesArea.clientHeight < 100;

    if (snapshot.empty) {
        messagesArea.innerHTML =
            '<div class="empty-chat"><h3>Start a Conversation!</h3><p>Say hello to your friend.</p></div>';

        messageElements.clear();
        return;
    }

    const currentIds = new Set();

    messagesArea.querySelector(".empty-chat")?.remove();

    snapshot.forEach(messageDoc => {
        const id = messageDoc.id;

        // Estimate server timestamps while pending
        const message = messageDoc.data({
            serverTimestamps: "estimate"
        });

        currentIds.add(id);

        updateMessageElement(message, id);

        const elements = messageElements.get(id);

        if (elements.bubble.parentElement !== messagesArea) {
            messagesArea.appendChild(elements.bubble);
        }

        // MARK RECEIVED MESSAGE AS READ
        if (
            message.senderId !== currentUser.uid &&
            !message.readAt &&
            !readRequests.has(id)
        ) {
            readRequests.add(id);

            updateDoc(
                doc(db, "chats", chatId, "messages", id),
                { readAt: serverTimestamp() }
            ).catch(error => {
                console.log("Read receipt error:", error.message);
                readRequests.delete(id);
            });
        }
    });

    // Remove messages no longer in snapshot
    for (const [id, elements] of messageElements) {
        if (!currentIds.has(id)) {
            elements.bubble.remove();
            messageElements.delete(id);
            readRequests.delete(id);
        }
    }

    if (wasNearBottom) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
}

// START CHAT LISTENER
function startChat() {
    const messagesRef = collection(
        db,
        "chats",
        chatId,
        "messages"
    );

    const messagesQuery = query(
        messagesRef,
        orderBy("sentAt", "asc")
    );

    unsubscribeMessages = onSnapshot(
        messagesQuery,
        { includeMetadataChanges: true },
        displayMessages,
        error => {
            messagesArea.textContent =
                "Chat error: " + error.message;
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
        event.preventDefault();
        sendButton.click();
    }
});

// LIVE TIME UPDATE
setInterval(() => {
    document.querySelectorAll(".message-status").forEach(status => {
        const sentAt = Number(status.dataset.sentAt);
        const readAt = Number(status.dataset.readAt);

        if (readAt) {
            status.textContent =
                "Seen " + formatTime(readAt);

        } else if (sentAt) {
            const bubble = status.closest(".message-bubble");

            if (bubble?.classList.contains("sent")) {
                status.textContent =
                    "Sent " + formatTime(sentAt);
            } else {
                status.textContent = formatTime(sentAt);
            }
        }
    });
}, 5000);

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

    // SAME CHAT ID FOR BOTH USERS
    chatId = [currentUser.uid, recipientUid]
        .sort()
        .join("_");

    try {
        const userDoc = await getDoc(
            doc(db, "users", recipientUid)
        );

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

        document.getElementById("chatStatus").textContent =
            "Wazzup";

        const chatRef = doc(db, "chats", chatId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
            await setDoc(chatRef, {
                participants: [
                    currentUser.uid,
                    recipientUid
                ],
                createdAt: serverTimestamp()
            });
        }

        if (unsubscribeMessages) {
            unsubscribeMessages();
        }

        startChat();

    } catch (error) {
        messagesArea.textContent =
            "Error: " + error.message;
    }
});
