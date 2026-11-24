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
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// =====================================
// FIREBASE
// =====================================

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

// =====================================
// HTML ELEMENTS
// =====================================

const messagesArea = document.getElementById("messagesArea");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const chatName = document.getElementById("chatName");
const chatStatus = document.getElementById("chatStatus");
const chatAvatar = document.querySelector(".chat-avatar");

const photoButton = document.getElementById("photoButton");
const photoInput = document.getElementById("photoInput");
const voiceButton = document.getElementById("voiceButton");

const voiceCallButton = document.getElementById("voiceCallButton");
const videoCallButton = document.getElementById("videoCallButton");

// =====================================
// GLOBAL VARIABLES
// =====================================

let currentUser = null;
let recipientId = null;
let recipientPresence = null;

let messageElements = new Map();

let unsubscribeMessages = null;
let unsubscribePresence = null;
let unsubscribeIncomingCalls = null;

let presenceInterval = null;
let recipientPhotoURL = null;

let mediaRecorder = null;
let recordedChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let isRecording = false;

const MAX_MEDIA_DATA_LENGTH = 800000;
const MAX_VIDEO_BYTES = 550 * 1024;
const MAX_VIDEO_SECONDS = 15;
const MAX_VOICE_SECONDS = 30;

// =====================================
// CALL VARIABLES
// =====================================

let peerConnection = null;
let localStream = null;
let remoteStream = null;

let activeCallId = null;
let activeCallType = null;
let callRole = null;

let unsubscribeActiveCall = null;
let unsubscribeRemoteCandidates = null;

let remoteDescriptionReady = false;
let pendingRemoteCandidates = [];
let pendingLocalCandidates = [];

let isCallEnding = false;
let incomingCallData = null;

// =====================================
// FULL SCREEN PHOTO VIEWER
// =====================================

const photoViewer = document.createElement("div");

photoViewer.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.95);
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
    border-radius:10px;
`;

const closePhoto = document.createElement("button");

closePhoto.textContent = "✕";

closePhoto.style.cssText = `
    position:absolute;
    top:20px;
    right:20px;
    color:white;
    background:transparent;
    font-size:30px;
    cursor:pointer;
    border:0;
`;

photoViewer.append(bigPhoto, closePhoto);
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

photoViewer.addEventListener("click", event => {
    if (event.target === photoViewer) closeBigPhoto();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeBigPhoto();
});

// =====================================
// RECIPIENT AND AUTH
// =====================================

const params = new URLSearchParams(window.location.search);
recipientId = params.get("uid");

if (!recipientId) alert("User not found!");

onAuthStateChanged(auth, async user => {
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
    listenForIncomingCalls();
});

async function loadRecipient() {
    try {
        const snap = await getDoc(doc(db, "users", recipientId));

        if (!snap.exists()) {
            chatName.textContent = "User not found";
            return;
        }

        const data = snap.data();

        chatName.textContent =
            data.name || data.username || "Wazzup User";

        if (!chatAvatar) return;

        const photoURL =
            data.photoURL || data.photoUrl || data.profilePhoto;

        chatAvatar.replaceChildren();

        if (photoURL) {
            recipientPhotoURL = photoURL;

            const image = document.createElement("img");

            image.src = photoURL;
            image.alt = "Profile Photo";

            image.style.cssText = `
                width:100%;
                height:100%;
                min-width:100%;
                min-height:100%;
                object-fit:cover;
                border-radius:50%;
                display:block;
            `;

            image.onerror = () => {
                recipientPhotoURL = null;
                chatAvatar.replaceChildren();

                chatAvatar.textContent =
                    (data.name || "U").charAt(0).toUpperCase();

                chatAvatar.onclick = null;
                chatAvatar.style.cursor = "default";
            };

            chatAvatar.appendChild(image);
            chatAvatar.style.overflow = "hidden";
            chatAvatar.style.cursor = "pointer";

            chatAvatar.onclick = () => openBigPhoto(recipientPhotoURL);

        } else {
            recipientPhotoURL = null;

            chatAvatar.textContent =
                (data.name || "U").charAt(0).toUpperCase();

            chatAvatar.onclick = null;
            chatAvatar.style.cursor = "default";
        }

    } catch (error) {
        console.error("Recipient error:", error);
    }
}

// =====================================
// ONLINE / LAST SEEN
// =====================================

async function updateMyPresence(isOnline) {
    if (!currentUser) return;

    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            isOnline,
            lastSeen: serverTimestamp()
        }, { merge: true });

    } catch (error) {
        console.error("Presence update error:", error);
    }
}

function startMyPresence() {
    updateMyPresence(true);

    if (presenceInterval) clearInterval(presenceInterval);

    presenceInterval = setInterval(() => {
        if (document.visibilityState === "visible") {
            updateMyPresence(true);
        }
    }, 30000);

    document.addEventListener("visibilitychange", () => {
        updateMyPresence(document.visibilityState === "visible");
    });

    window.addEventListener("pagehide", () => {
        updateMyPresence(false);
    });
}

function listenToRecipientPresence() {
    unsubscribePresence = onSnapshot(
        doc(db, "users", recipientId),
        snapshot => {
            recipientPresence = snapshot.exists()
                ? snapshot.data()
                : null;

            showRecipientPresence();
        },
        error => {
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
        recent = Date.now() - lastSeen.toDate().getTime() < 70000;
    }

    if (recipientPresence.isOnline && recent) {
        chatStatus.textContent = "Online";

    } else if (lastSeen) {
        chatStatus.textContent = "Last seen " + formatTime(lastSeen);

    } else {
        chatStatus.textContent = "Offline";
    }
}

function formatTime(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "just now";
    }

    const time = timestamp.toDate();
    const seconds = Math.floor(
        (Date.now() - time.getTime()) / 1000
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

    if (days < 7) {
        return days +
            (days === 1 ? " day ago" : " days ago");
    }

    return time.toLocaleDateString();
}

function getChatId() {
    return [currentUser.uid, recipientId].sort().join("_");
}

// =====================================
// LOAD MESSAGES - RACE CONDITION FIX
// =====================================

async function loadMessages() {
    const chatId = getChatId();
    const chatRef = doc(db, "chats", chatId);

    try {
        await runTransaction(db, async transaction => {
            const chatSnap = await transaction.get(chatRef);

            if (!chatSnap.exists()) {
                transaction.set(chatRef, {
                    participants: [
                        currentUser.uid,
                        recipientId
                    ],
                    createdAt: serverTimestamp()
                });
            }
        });

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

        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        messageElements.clear();
        messagesArea.replaceChildren();

        unsubscribeMessages = onSnapshot(
            q,
            snapshot => {
                snapshot.docChanges().forEach(change => {
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
            },
            error => {
                console.error("Message listener error:", error);

                if (chatStatus) {
                    chatStatus.textContent =
                        "Connection problem. Reopen chat.";
                }
            }
        );

    } catch (error) {
        console.error("Messages error:", error);

        alert(
            "Chat load nahi hua: " +
            (error.message || "Internet ya Firebase Rules check karo.")
        );
    }
}

// =====================================
// MESSAGE DISPLAY
// =====================================

function createMessage(messageId, message) {
    if (messageElements.has(messageId)) return;

    const isSent = message.senderId === currentUser.uid;

    const bubble = document.createElement("div");

    bubble.className = isSent
        ? "message sent"
        : "message received";

    bubble.style.cssText = `
        display:flex;
        flex-direction:column;
        width:fit-content;
        max-width:75%;
        padding:12px 16px;
        margin:8px 12px;
        border-radius:20px;
        box-sizing:border-box;
        overflow-wrap:anywhere;
        text-align:left;
        background:${isSent ? "#38bdf8" : "#262626"};
        color:${isSent ? "#071827" : "#ffffff"};
        align-self:${isSent ? "flex-end" : "flex-start"};
        margin-left:${isSent ? "auto" : "12px"};
        margin-right:${isSent ? "12px" : "auto"};
        border-bottom-${isSent ? "right" : "left"}-radius:5px;
    `;

    const content = document.createElement("div");

    content.style.cssText = `
        display:flex;
        flex-direction:column;
        gap:7px;
    `;

    const type = message.type || "text";

    if (type === "photo" && message.mediaData) {
        const image = document.createElement("img");

        image.src = message.mediaData;
        image.alt = message.fileName || "Photo";
        image.loading = "lazy";

        image.style.cssText = `
            display:block;
            max-width:100%;
            max-height:300px;
            width:auto;
            border-radius:10px;
            object-fit:contain;
            cursor:pointer;
        `;

        image.addEventListener("click", () => {
            openBigPhoto(message.mediaData);
        });

        content.appendChild(image);

    } else if (type === "video" && message.mediaData) {
        const video = document.createElement("video");

        video.src = message.mediaData;
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";

        video.style.cssText = `
            display:block;
            width:100%;
            max-width:260px;
            max-height:300px;
            border-radius:10px;
        `;

        content.appendChild(video);

    } else if (type === "voice" && message.mediaData) {
        const audio = document.createElement("audio");

        audio.src = message.mediaData;
        audio.controls = true;
        audio.preload = "metadata";

        audio.style.cssText = `
            display:block;
            width:230px;
            max-width:100%;
        `;

        content.appendChild(audio);

        const voiceLabel = document.createElement("small");
        voiceLabel.textContent = "🎙️ Voice message";

        content.appendChild(voiceLabel);

    } else {
        const text = document.createElement("p");

        text.textContent = message.text || "";

        text.style.cssText = `
            color:${isSent ? "#071827" : "#ffffff"};
            font-weight:bold;
            margin:0;
            padding:0;
            font-size:16px;
            line-height:1.4;
            text-align:left;
            white-space:pre-wrap;
        `;

        content.appendChild(text);
    }

    const status = document.createElement("small");

    status.className = "message-status";

    status.style.cssText = `
        color:${isSent ? "#071827" : "#ffffff"};
        font-size:11px;
        font-weight:bold;
        margin-top:6px;
        align-self:flex-end;
        opacity:.8;
    `;

    bubble.append(content, status);
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
        item.status.textContent = message.readAt
            ? "Seen " + formatTime(message.readAt)
            : "Sent " + formatTime(message.sentAt);

    } else {
        item.status.textContent = formatTime(message.sentAt);
    }
}

// =====================================
// MARK MESSAGES AS READ
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
// SEND TEXT MESSAGE
// =====================================

sendButton.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter") sendMessage();
});

async function sendMessage() {
    const text = messageInput.value.trim();

    if (!text || !currentUser || !recipientId) return;

    sendButton.disabled = true;

    try {
        await addDoc(
            collection(db, "chats", getChatId(), "messages"),
            {
                text,
                senderId: currentUser.uid,
                sentAt: serverTimestamp(),
                readAt: null
            }
        );

        messageInput.value = "";

    } catch (error) {
        console.error("Send message error:", error);

        alert("Message send nahi hua. Dobara try karo.");

    } finally {
        sendButton.disabled = false;
    }
}
// =====================================
// FILE HELPERS
// =====================================

function fileToDataURL(fileOrBlob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);

        reader.onerror = () => {
            reject(new Error("File read nahi ho payi."));
        };

        reader.readAsDataURL(fileOrBlob);
    });
}

function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const url = URL.createObjectURL(file);

        video.preload = "metadata";

        video.onloadedmetadata = () => {
            const duration = video.duration;

            URL.revokeObjectURL(url);
            resolve(duration);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);

            reject(new Error("Video open nahi ho pa raha."));
        };

        video.src = url;
    });
}

async function compressPhoto(file) {
    const sourceURL = URL.createObjectURL(file);

    try {
        const image = new Image();

        image.src = sourceURL;

        await new Promise((resolve, reject) => {
            image.onload = resolve;

            image.onerror = () => {
                reject(new Error("Photo open nahi ho payi."));
            };
        });

        const maxSide = 1200;

        const scale = Math.min(
            1,
            maxSide / Math.max(image.width, image.height)
        );

        const canvas = document.createElement("canvas");

        canvas.width = Math.max(
            1,
            Math.round(image.width * scale)
        );

        canvas.height = Math.max(
            1,
            Math.round(image.height * scale)
        );

        const context = canvas.getContext("2d");

        context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
        );

        let quality = 0.78;

        let blob = await new Promise(resolve => {
            canvas.toBlob(resolve, "image/jpeg", quality);
        });

        while (blob && blob.size > 500 * 1024 && quality > 0.35) {
            quality -= 0.1;

            blob = await new Promise(resolve => {
                canvas.toBlob(resolve, "image/jpeg", quality);
            });
        }

        if (!blob || blob.size > 550 * 1024) {
            throw new Error(
                "Photo ka size kam nahi ho paaya. Chhoti photo select karo."
            );
        }

        return blob;

    } finally {
        URL.revokeObjectURL(sourceURL);
    }
}

// =====================================
// SAVE MEDIA MESSAGE
// =====================================

async function sendMediaMessage(data) {
    if (!currentUser || !recipientId) return;

    if (
        typeof data.mediaData !== "string" ||
        data.mediaData.length > MAX_MEDIA_DATA_LENGTH
    ) {
        throw new Error(
            "Media file bahut badi hai. Chhoti file select karo."
        );
    }

    await addDoc(
        collection(db, "chats", getChatId(), "messages"),
        {
            ...data,
            senderId: currentUser.uid,
            sentAt: serverTimestamp(),
            readAt: null
        }
    );
}

// =====================================
// PHOTO AND VIDEO SENDING
// =====================================

if (photoButton && photoInput) {
    photoButton.addEventListener("click", () => {
        photoInput.click();
    });

    photoInput.addEventListener("change", async () => {
        const files = Array.from(photoInput.files || []);

        if (!files.length) return;

        photoButton.disabled = true;

        try {
            for (const file of files) {
                if (file.type.startsWith("image/")) {
                    const compressed = await compressPhoto(file);

                    const mediaData = await fileToDataURL(compressed);

                    await sendMediaMessage({
                        type: "photo",
                        mediaData,
                        mediaMime: "image/jpeg",
                        fileName: file.name.slice(0, 150)
                    });

                } else if (file.type.startsWith("video/")) {
                    if (
                        ![
                            "video/mp4",
                            "video/webm",
                            "video/quicktime"
                        ].includes(file.type)
                    ) {
                        throw new Error(
                            "Video format MP4, WEBM ya MOV hona chahiye."
                        );
                    }

                    if (file.size > MAX_VIDEO_BYTES) {
                        throw new Error(
                            "Video 550 KB se chhota hona chahiye."
                        );
                    }

                    const duration = await getVideoDuration(file);

                    if (
                        !Number.isFinite(duration) ||
                        duration <= 0 ||
                        duration > MAX_VIDEO_SECONDS
                    ) {
                        throw new Error(
                            "Video 15 seconds ya usse chhota hona chahiye."
                        );
                    }

                    const mediaData = await fileToDataURL(file);

                    await sendMediaMessage({
                        type: "video",
                        mediaData,
                        mediaMime: file.type,
                        fileName: file.name.slice(0, 150),
                        duration: Math.ceil(duration)
                    });

                } else {
                    throw new Error(
                        "Sirf photo aur video files select karo."
                    );
                }
            }

        } catch (error) {
            console.error("Media send error:", error);

            alert(
                error.message ||
                "Media send nahi hua. Dobara try karo."
            );

        } finally {
            photoButton.disabled = false;
            photoInput.value = "";
        }
    });
}

// =====================================
// VOICE RECORDING
// =====================================

function chooseAudioMimeType() {
    if (!window.MediaRecorder) return "";

    const options = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4"
    ];

    return options.find(type => {
        return MediaRecorder.isTypeSupported(type);
    }) || "";
}

async function startVoiceRecording() {
    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia ||
        !window.MediaRecorder
    ) {
        alert("Is browser mein voice recording supported nahi hai.");
        return;
    }

    let stream;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        recordedChunks = [];

        const mimeType = chooseAudioMimeType();

        mediaRecorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);

        mediaRecorder.ondataavailable = event => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            clearInterval(recordingTimer);

            stream.getTracks().forEach(track => track.stop());

            const blob = new Blob(recordedChunks, {
                type: mediaRecorder.mimeType || "audio/webm"
            });

            if (blob.size === 0) {
                alert("Voice record nahi hui. Dobara try karo.");
                return;
            }

            try {
                const mediaData = await fileToDataURL(blob);

                if (mediaData.length > MAX_MEDIA_DATA_LENGTH) {
                    throw new Error(
                        "Voice recording badi hai. Chhoti recording bhejo."
                    );
                }

                const mime = (blob.type || "audio/webm").split(";")[0];

                if (
                    ![
                        "audio/webm",
                        "audio/ogg",
                        "audio/mp4",
                        "audio/mpeg"
                    ].includes(mime)
                ) {
                    throw new Error(
                        "Is browser ka audio format supported nahi hai."
                    );
                }

                await sendMediaMessage({
                    type: "voice",
                    mediaData,
                    mediaMime: mime,
                    duration: Math.max(1, recordingSeconds)
                });

            } catch (error) {
                console.error("Voice send error:", error);

                alert(
                    error.message ||
                    "Voice message send nahi hua."
                );
            }
        };

        mediaRecorder.start();

        isRecording = true;
        recordingSeconds = 0;

        voiceButton.textContent = "⏹️ Stop (0s)";

        recordingTimer = setInterval(() => {
            recordingSeconds++;

            voiceButton.textContent =
                `⏹️ Stop (${recordingSeconds}s)`;

            if (recordingSeconds >= MAX_VOICE_SECONDS) {
                stopVoiceRecording();
            }
        }, 1000);

    } catch (error) {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        console.error("Microphone error:", error);

        alert("Microphone permission do, phir voice record karo.");
    }
}

function stopVoiceRecording() {
    if (!isRecording || !mediaRecorder) return;

    isRecording = false;

    clearInterval(recordingTimer);

    voiceButton.disabled = true;
    voiceButton.textContent = "Sending...";

    if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }

    setTimeout(() => {
        voiceButton.disabled = false;
        voiceButton.textContent = "🎙️";
    }, 500);
}

if (voiceButton) {
    voiceButton.addEventListener("click", () => {
        if (isRecording) {
            stopVoiceRecording();
        } else {
            startVoiceRecording();
        }
    });
}

// =====================================
// CALL UI
// =====================================

const callOverlay = document.createElement("div");

callOverlay.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    z-index:100000;
    background:#050505;
    color:white;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    padding:20px;
    box-sizing:border-box;
`;

const callTitle = document.createElement("h2");

callTitle.textContent = "Wazzup Call";

callTitle.style.cssText = `
    font-size:24px;
    margin:15px 0 5px;
`;

const callStatusText = document.createElement("p");

callStatusText.textContent = "Connecting...";

callStatusText.style.cssText = `
    color:#aaa;
    margin:5px 0 20px;
    font-size:15px;
`;

const remoteVideo = document.createElement("video");

remoteVideo.autoplay = true;
remoteVideo.playsInline = true;

remoteVideo.style.cssText = `
    display:none;
    width:100%;
    max-width:600px;
    max-height:55vh;
    background:#171717;
    border-radius:16px;
    object-fit:cover;
`;

const localVideo = document.createElement("video");

localVideo.autoplay = true;
localVideo.muted = true;
localVideo.playsInline = true;

localVideo.style.cssText = `
    display:none;
    position:absolute;
    top:20px;
    right:20px;
    width:110px;
    height:150px;
    background:#222;
    border:2px solid #20e878;
    border-radius:12px;
    object-fit:cover;
`;

const callControls = document.createElement("div");

callControls.style.cssText = `
    display:flex;
    justify-content:center;
    align-items:center;
    flex-wrap:wrap;
    gap:15px;
    margin-top:35px;
`;

function createCallButton(label, background = "#222") {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;

    button.style.cssText = `
        min-width:60px;
        min-height:55px;
        border:0;
        border-radius:50px;
        padding:12px;
        background:${background};
        color:white;
        font-size:15px;
        cursor:pointer;
    `;

    return button;
}

const muteButton = createCallButton("🎙️ Mute");
const cameraButton = createCallButton("📷 Camera");
const endCallButton = createCallButton("📞 End", "#e53935");

callControls.append(
    muteButton,
    cameraButton,
    endCallButton
);

callOverlay.append(
    callTitle,
    callStatusText,
    remoteVideo,
    localVideo,
    callControls
);

document.body.appendChild(callOverlay);

// =====================================
// INCOMING CALL UI
// =====================================

const incomingOverlay = document.createElement("div");

incomingOverlay.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    z-index:100001;
    background:rgba(0,0,0,.94);
    align-items:center;
    justify-content:center;
    padding:20px;
    box-sizing:border-box;
`;

const incomingCard = document.createElement("div");

incomingCard.style.cssText = `
    width:100%;
    max-width:350px;
    padding:30px 20px;
    background:#151515;
    border:1px solid #333;
    border-radius:22px;
    text-align:center;
    color:white;
`;

const incomingTitle = document.createElement("h2");

incomingTitle.textContent = "Incoming Call";

const incomingName = document.createElement("p");

incomingName.style.cssText = `
    font-size:19px;
    color:#20e878;
`;

const incomingType = document.createElement("p");

incomingType.style.cssText = `
    color:#aaa;
    margin-bottom:25px;
`;

const incomingButtons = document.createElement("div");

incomingButtons.style.cssText = `
    display:flex;
    justify-content:center;
    gap:20px;
`;

const acceptButton = createCallButton("Accept", "#20a85a");
const rejectButton = createCallButton("Reject", "#e53935");

incomingButtons.append(acceptButton, rejectButton);

incomingCard.append(
    incomingTitle,
    incomingName,
    incomingType,
    incomingButtons
);

incomingOverlay.appendChild(incomingCard);

document.body.appendChild(incomingOverlay);
// =====================================
// SHOW CALL SCREEN
// =====================================

function showCallScreen(type, status) {
    callTitle.textContent =
        type === "video" ? "📹 Video Call" : "📞 Voice Call";

    callStatusText.textContent = status;

    callOverlay.style.display = "flex";

    remoteVideo.style.display =
        type === "video" ? "block" : "none";

    localVideo.style.display =
        type === "video" ? "block" : "none";

    cameraButton.style.display =
        type === "video" ? "inline-block" : "none";

    document.body.style.overflow = "hidden";
}

function hideCallScreen() {
    callOverlay.style.display = "none";
    incomingOverlay.style.display = "none";

    remoteVideo.srcObject = null;
    localVideo.srcObject = null;

    document.body.style.overflow = "";
}

// =====================================
// WEBRTC CONNECTION
// =====================================

function createPeerConnection() {
    const pc = new RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302"
            },
            {
                urls: "stun:stun1.l.google.com:19302"
            }
        ]
    });

    remoteStream = new MediaStream();

    remoteVideo.srcObject = remoteStream;

    pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => {
            const alreadyAdded = remoteStream
                .getTracks()
                .some(existing => existing.id === track.id);

            if (!alreadyAdded) {
                remoteStream.addTrack(track);
            }
        });

        remoteVideo.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
        console.log("Call connection:", pc.connectionState);

        if (pc.connectionState === "connected") {
            callStatusText.textContent = "Connected";
        }

        if (
            pc.connectionState === "failed" ||
            pc.connectionState === "disconnected"
        ) {
            callStatusText.textContent =
                "Connection problem. Call end ho sakti hai.";
        }
    };

    pc.onicecandidate = async event => {
        if (!event.candidate) return;

        const candidate = event.candidate.toJSON();

        const data = {
            candidate: candidate.candidate
        };

        if (candidate.sdpMid !== null && candidate.sdpMid !== undefined) {
            data.sdpMid = candidate.sdpMid;
        }

        if (
            candidate.sdpMLineIndex !== null &&
            candidate.sdpMLineIndex !== undefined
        ) {
            data.sdpMLineIndex = candidate.sdpMLineIndex;
        }

        if (
            candidate.usernameFragment !== null &&
            candidate.usernameFragment !== undefined
        ) {
            data.usernameFragment = candidate.usernameFragment;
        }

        if (!activeCallId) {
            pendingLocalCandidates.push(data);
            return;
        }

        try {
            const candidateCollection =
                callRole === "caller"
                    ? "callerCandidates"
                    : "calleeCandidates";

            await addDoc(
                collection(
                    db,
                    "calls",
                    activeCallId,
                    candidateCollection
                ),
                data
            );

        } catch (error) {
            console.error("ICE candidate save error:", error);
        }
    };

    return pc;
}

// =====================================
// LOCAL MEDIA
// =====================================

async function getCallMedia(type) {
    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        throw new Error(
            "Camera/microphone supported nahi hai. HTTPS par app kholo."
        );
    }

    const constraints = {
        audio: true,
        video: type === "video"
            ? {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
            : false
    };

    localStream = await navigator.mediaDevices.getUserMedia(
        constraints
    );

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    if (type === "video") {
        localVideo.srcObject = localStream;
        localVideo.play().catch(() => {});
    }
}

// =====================================
// FLUSH LOCAL ICE CANDIDATES
// =====================================

async function flushLocalCandidates() {
    if (!activeCallId || pendingLocalCandidates.length === 0) {
        return;
    }

    const candidates = [...pendingLocalCandidates];

    pendingLocalCandidates = [];

    const candidateCollection =
        callRole === "caller"
            ? "callerCandidates"
            : "calleeCandidates";

    for (const candidate of candidates) {
        try {
            await addDoc(
                collection(
                    db,
                    "calls",
                    activeCallId,
                    candidateCollection
                ),
                candidate
            );

        } catch (error) {
            console.error("Pending ICE save error:", error);
        }
    }
}

// =====================================
// REMOTE ICE CANDIDATES
// =====================================

async function addRemoteCandidate(data) {
    if (!peerConnection) return;

    try {
        const candidate = new RTCIceCandidate({
            candidate: data.candidate,
            sdpMid: data.sdpMid ?? null,
            sdpMLineIndex: data.sdpMLineIndex ?? null,
            usernameFragment: data.usernameFragment ?? null
        });

        if (!remoteDescriptionReady) {
            pendingRemoteCandidates.push(candidate);
            return;
        }

        await peerConnection.addIceCandidate(candidate);

    } catch (error) {
        console.error("Remote ICE error:", error);
    }
}

async function flushRemoteCandidates() {
    if (!remoteDescriptionReady || !peerConnection) return;

    const candidates = [...pendingRemoteCandidates];

    pendingRemoteCandidates = [];

    for (const candidate of candidates) {
        try {
            await peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.error("ICE candidate error:", error);
        }
    }
}

function listenToRemoteCandidates() {
    const remoteCollection =
        callRole === "caller"
            ? "calleeCandidates"
            : "callerCandidates";

    const q = collection(
        db,
        "calls",
        activeCallId,
        remoteCollection
    );

    unsubscribeRemoteCandidates = onSnapshot(
        q,
        snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === "added") {
                    addRemoteCandidate(change.doc.data());
                }
            });
        },
        error => {
            console.error("Remote candidates listener:", error);
        }
    );
}

// =====================================
// START OUTGOING CALL
// =====================================

async function startOutgoingCall(type) {
    if (!currentUser || !recipientId) return;

    if (activeCallId) {
        alert("Ek call pehle se chal rahi hai.");
        return;
    }

    try {
        activeCallType = type;
        callRole = "caller";

        isCallEnding = false;
        pendingLocalCandidates = [];
        pendingRemoteCandidates = [];
        remoteDescriptionReady = false;

        showCallScreen(
            type,
            "Calling " + (chatName.textContent || "User") + "..."
        );

        callStatusText.textContent =
            "Microphone permission maang rahe hain...";

        peerConnection = createPeerConnection();

        await getCallMedia(type);

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);

        const callRef = await addDoc(
            collection(db, "calls"),
            {
                callerId: currentUser.uid,
                receiverId: recipientId,
                callType: type,
                status: "ringing",
                offer: {
                    type: offer.type,
                    sdp: offer.sdp
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }
        );

        activeCallId = callRef.id;

        await flushLocalCandidates();

        listenToRemoteCandidates();
        listenToActiveCall();

        callStatusText.textContent = "Ringing...";

    } catch (error) {
        console.error("Outgoing call error:", error);

        alert(
            error.message ||
            "Call start nahi hui. Camera/microphone permission check karo."
        );

        await cleanupCall();
    }
}

// =====================================
// LISTEN TO ACTIVE CALL
// =====================================

function listenToActiveCall() {
    if (!activeCallId) return;

    unsubscribeActiveCall = onSnapshot(
        doc(db, "calls", activeCallId),
        async snapshot => {
            if (!snapshot.exists()) {
                await cleanupCall();
                return;
            }

            const data = snapshot.data();

            if (data.status === "accepted" && callRole === "caller") {
                if (!data.answer || remoteDescriptionReady) return;

                try {
                    await peerConnection.setRemoteDescription(
                        new RTCSessionDescription(data.answer)
                    );

                    remoteDescriptionReady = true;

                    await flushRemoteCandidates();

                    callStatusText.textContent = "Connected";

                } catch (error) {
                    console.error("Answer error:", error);
                }
            }

            if (
                data.status === "rejected" ||
                data.status === "cancelled" ||
                data.status === "ended"
            ) {
                callStatusText.textContent = "Call ended";

                setTimeout(() => {
                    if (activeCallId) cleanupCall();
                }, 500);
            }
        },
        error => {
            console.error("Active call listener:", error);
        }
    );
}

// =====================================
// INCOMING CALL LISTENER
// =====================================

function listenForIncomingCalls() {
    if (!currentUser) return;

    const q = query(
        collection(db, "calls"),
        where("receiverId", "==", currentUser.uid)
    );

    unsubscribeIncomingCalls = onSnapshot(
        q,
        snapshot => {
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();

                if (
                    change.type === "added" ||
                    change.type === "modified"
                ) {
                    if (
                        data.status === "ringing" &&
                        !activeCallId &&
                        incomingCallData?.id !== change.doc.id
                    ) {
                        showIncomingCall(change.doc.id, data);
                    }

                    if (
                        incomingCallData &&
                        incomingCallData.id === change.doc.id &&
                        data.status !== "ringing"
                    ) {
                        incomingOverlay.style.display = "none";
                        incomingCallData = null;
                    }
                }
            });
        },
        error => {
            console.error("Incoming calls listener:", error);
        }
    );
}

// =====================================
// SHOW INCOMING CALL
// =====================================

function showIncomingCall(callId, data) {
    if (activeCallId) return;

    incomingCallData = {
        id: callId,
        data
    };

    incomingName.textContent =
        chatName.textContent || "Wazzup User";

    incomingTitle.textContent = "Incoming Call";

    incomingType.textContent =
        data.callType === "video"
            ? "📹 Incoming video call"
            : "📞 Incoming voice call";

    incomingOverlay.style.display = "flex";
}

// =====================================
// ACCEPT INCOMING CALL
// =====================================

async function acceptIncomingCall() {
    if (!incomingCallData || !currentUser) return;

    const callId = incomingCallData.id;
    const data = incomingCallData.data;

    incomingOverlay.style.display = "none";

    try {
        activeCallId = callId;
        activeCallType = data.callType;
        callRole = "receiver";

        isCallEnding = false;
        pendingLocalCandidates = [];
        pendingRemoteCandidates = [];
        remoteDescriptionReady = false;

        showCallScreen(
            activeCallType,
            "Connecting..."
        );

        peerConnection = createPeerConnection();

        await getCallMedia(activeCallType);

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.offer)
        );

        remoteDescriptionReady = true;

        await flushRemoteCandidates();

        listenToRemoteCandidates();

        const answer = await peerConnection.createAnswer();

        await peerConnection.setLocalDescription(answer);

        await updateDoc(
            doc(db, "calls", activeCallId),
            {
                answer: {
                    type: answer.type,
                    sdp: answer.sdp
                },
                status: "accepted",
                updatedAt: serverTimestamp()
            }
        );

        await flushLocalCandidates();

        listenToActiveCall();

        incomingCallData = null;

        callStatusText.textContent = "Connected";

    } catch (error) {
        console.error("Accept call error:", error);

        alert(
            error.message ||
            "Call connect nahi hui. Permission check karo."
        );

        await cleanupCall();
    }
}

// =====================================
// REJECT INCOMING CALL
// =====================================

async function rejectIncomingCall() {
    if (!incomingCallData) return;

    const callId = incomingCallData.id;

    incomingOverlay.style.display = "none";
    incomingCallData = null;

    try {
        await updateDoc(
            doc(db, "calls", callId),
            {
                status: "rejected",
                updatedAt: serverTimestamp()
            }
        );

    } catch (error) {
        console.error("Reject call error:", error);
    }
}

// =====================================
// END CALL
// =====================================

async function endActiveCall() {
    if (!activeCallId || isCallEnding) return;

    isCallEnding = true;

    const callId = activeCallId;

    try {
        await updateDoc(
            doc(db, "calls", callId),
            {
                status: "ended",
                updatedAt: serverTimestamp(),
                endedAt: serverTimestamp()
            }
        );

    } catch (error) {
        console.error("End call error:", error);

    } finally {
        await cleanupCall();
    }
}

// =====================================
// CLEANUP CALL
// =====================================

async function cleanupCall() {
    if (unsubscribeActiveCall) {
        unsubscribeActiveCall();
        unsubscribeActiveCall = null;
    }

    if (unsubscribeRemoteCandidates) {
        unsubscribeRemoteCandidates();
        unsubscribeRemoteCandidates = null;
    }

    if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;

        peerConnection.close();
        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }

    activeCallId = null;
    activeCallType = null;
    callRole = null;

    remoteDescriptionReady = false;

    pendingRemoteCandidates = [];
    pendingLocalCandidates = [];

    incomingCallData = null;

    isCallEnding = false;

    hideCallScreen();

    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
}

// =====================================
// MICROPHONE MUTE
// =====================================

muteButton.addEventListener("click", () => {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();

    if (!audioTracks.length) return;

    const currentlyEnabled = audioTracks[0].enabled;

    audioTracks.forEach(track => {
        track.enabled = !currentlyEnabled;
    });

    muteButton.textContent =
        currentlyEnabled ? "🔇 Unmute" : "🎙️ Mute";
});

// =====================================
// CAMERA ON / OFF
// =====================================

cameraButton.addEventListener("click", () => {
    if (!localStream) return;

    const videoTracks = localStream.getVideoTracks();

    if (!videoTracks.length) return;

    const currentlyEnabled = videoTracks[0].enabled;

    videoTracks.forEach(track => {
        track.enabled = !currentlyEnabled;
    });

    cameraButton.textContent =
        currentlyEnabled ? "📷 Camera On" : "📷 Camera Off";
});

// =====================================
// BUTTON EVENTS
// =====================================

if (voiceCallButton) {
    voiceCallButton.addEventListener("click", () => {
        startOutgoingCall("audio");
    });
}

if (videoCallButton) {
    videoCallButton.addEventListener("click", () => {
        startOutgoingCall("video");
    });
}

acceptButton.addEventListener("click", acceptIncomingCall);

rejectButton.addEventListener("click", rejectIncomingCall);

endCallButton.addEventListener("click", endActiveCall);

// =====================================
// CLEANUP
// =====================================

window.addEventListener("beforeunload", () => {
    if (presenceInterval) {
        clearInterval(presenceInterval);
    }

    if (recordingTimer) {
        clearInterval(recordingTimer);
    }

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }

    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    if (unsubscribePresence) {
        unsubscribePresence();
    }

    if (unsubscribeIncomingCalls) {
        unsubscribeIncomingCalls();
    }

    if (unsubscribeActiveCall) {
        unsubscribeActiveCall();
    }

    if (unsubscribeRemoteCandidates) {
        unsubscribeRemoteCandidates();
    }

    if (peerConnection) {
        peerConnection.close();
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});
