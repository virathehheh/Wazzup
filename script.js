
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// FIREBASE CONFIGURATION
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

// BUTTON AND INPUTS
const signupButton =
    document.getElementById("loginButton") ||
    document.querySelector(".login-box button");

const inputs = document.querySelectorAll(".login-box input");

// SIGNUP SYSTEM
if (signupButton && inputs.length === 5) {

    signupButton.addEventListener("click", async function () {

        const name = inputs[0].value.trim();
        const username = inputs[1].value.trim();
        const email = inputs[2].value.trim();
        const password = inputs[3].value;
        const confirmPassword = inputs[4].value;

        if (!name || !username || !email || !password || !confirmPassword) {
            alert("Please fill all fields!");
            return;
        }

        if (password.length < 6) {
            alert("Password must be at least 6 characters!");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        try {

            const result = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            await updateProfile(result.user, {
                displayName: name
            });

            // SAVE USER DATA IN FIRESTORE
            await setDoc(doc(db, "users", result.user.uid), {
                uid: result.user.uid,
                name: name,
                username: username,
                email: email,
                createdAt: serverTimestamp()
            });

            alert("Wazzup Account Created Successfully!");

            window.location.href = "index.html";

        } catch (error) {
            alert(error.message);
        }
    });
}

// LOGIN SYSTEM
if (signupButton && inputs.length === 2) {

    signupButton.addEventListener("click", async function () {

        const email = inputs[0].value.trim();
        const password = inputs[1].value;

        if (!email || !password) {
            alert("Please enter email and password!");
            return;
        }

        try {

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            alert("Login Successful! Welcome to Wazzup.");

            window.location.assign("./home.html");

        } catch (error) {
            alert(error.message);
        }
    });
}

// FORGOT PASSWORD SYSTEM
const forgotPassword = document.getElementById("forgotPassword");

if (forgotPassword) {

    forgotPassword.addEventListener("click", async function (event) {

        event.preventDefault();

        const email = prompt("Enter your registered email address:");

        if (!email) {
            return;
        }

        try {

            await sendPasswordResetEmail(auth, email.trim());

            alert("Password reset link sent! Please check your email.");

        } catch (error) {
            alert(error.message);
        }
    });
}
