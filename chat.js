
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

let currentUser = null;
let recipientId = null;
let recipientPresence = null;
let messageElements = new Map();
let unsubscribeMessages = null;
let unsubscribePresence = null;
let presenceInterval = null;

// RECIPIENT DETAILS
const params = new URLSearchParams(window.location.search);
recipientId = params.get("uid");

if (!recipientId) {
    alert("User not found!");
}

// AUTH CHECK
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

// LOAD RECIPIENT
async function loadRecipient() {
    try {
        const userRef = doc(db, "users", recipientId);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            const data = snap.data();
            chatName.textContent =
                data.name || data.username || "Wazzup User";
        }
    } catch (error) {
        console.error("Recipient error:", error);
    }
}

// MY ONLINE / LAST SEEN
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

// RECIPIENT ONLINE / LAST SEEN
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

// TIME FORMAT
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
        return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return hours + (hours === 1 ? " hour ago" : " hours ago");
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
        return days + (days === 1 ? " day ago" : " days ago");
    }

    return time.toLocaleDateString();
}

// CHAT ID
function getChatId() {
    return [currentUser.uid, recipientId]
        .sort()
        .join("_");
}

// LOAD MESSAGES
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

        const q = query(messagesRef, orderBy("sentAt", "asc"));

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

// CREATE MESSAGE ELEMENT
function createMessage(messageId, message) {
    if (messageElements.has(messageId)) return;

    const bubble = document.createElement("div");
    bubble.className =
        message.senderId === currentUser.uid
            ? "message sent"
            : "message received";

    const text = document.createElement("p");
    text.textContent = message.text || "";

    const status = document.createElement("small");
    status.className = "message-status";

    bubble.appendChild(text);
    bubble.appendChild(status);

    messagesArea.appendChild(bubble);

    messageElements.set(messageId, {
        bubble,
        status,
        message
    });

    updateMessage(messageId, message);

    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// UPDATE MESSAGE STATUS
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

// MARK RECEIVED MESSAGES AS READ
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

// SEND MESSAGE
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

// CLEANUP
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
