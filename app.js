// 🔥 Firebase imports
import { auth, db } from "./firebase.js";
import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// 🧱 DOM Elements
const notesList = document.getElementById("notes-list");
const logoutBtn = document.getElementById("logout-btn");

// 📦 Alert Box Setup
const alertBox = document.getElementById("alert-box");

function showMessage(message, type = "success") {
  alertBox.textContent = message;
  alertBox.style.display = "block";
  alertBox.style.backgroundColor = type === "success" ? "#d4edda" : "#f8d7da";
  alertBox.style.color = type === "success" ? "#155724" : "#721c24";
  setTimeout(() => (alertBox.style.display = "none"), 3000);
}

// 🔐 Auth Guard
onAuthStateChanged(auth, (user) => {
  if (user) {
    fetchNotes(user.uid);
  } else {
    window.location.href = "login.html";
  }
});

// 📥 Fetch Notes

// Track rendered notes by ID
const renderedNotes = new Map();

function fetchNotes(uid) {
  const q = query(
    collection(db, "notes"),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    const newNotes = new Map();
    snapshot.forEach((docSnap) => {
      newNotes.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
    });

    // Remove deleted notes
    for (const id of renderedNotes.keys()) {
      if (!newNotes.has(id)) {
        const el = document.getElementById(`note-${id}`);
        if (el) notesList.removeChild(el);
        renderedNotes.delete(id);
      }
    }

    // Add or update notes
    let idx = 0;
    newNotes.forEach((note, id) => {
      if (!renderedNotes.has(id)) {
        // New note, render and insert at correct position
        const noteEl = renderNote(note);
        noteEl.id = `note-${id}`;
        notesList.insertBefore(noteEl, notesList.children[idx]);
        renderedNotes.set(id, noteEl);
      } else {
        // Existing note, update content if changed
        const noteEl = renderedNotes.get(id);
        const textarea = noteEl.querySelector("textarea");
        if (textarea.value !== note.content) {
          textarea.value = note.content || "";
          setTimeout(() => autoResize.call(textarea), 0);
        }
      }
      idx++;
    });

    // Empty state
    const emptyState = document.getElementById('empty-state');
    if (newNotes.size === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
    }
  });
}

// 🧠 Render Note
function renderNote(note) {
  const noteEl = document.createElement("div");
  noteEl.className = "note";

  const textarea = document.createElement("textarea");
  textarea.value = note.content || "";
  textarea.placeholder = "Type your note here...";
  textarea.rows = 1;
  textarea.addEventListener("input", autoResize);
  textarea.addEventListener("input", () => setSavingStatus(true));
  textarea.addEventListener("input", debounce(() => {
    updateNote(note.id, textarea.value);
    setSavingStatus(false);
  }, 200));
  setTimeout(() => autoResize.call(textarea), 0);

  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete Note";
  delBtn.onclick = () => showDeleteModal(note.id);
// Custom confirm delete modal
const confirmDeleteModal = document.getElementById("confirm-delete-modal");
let pendingDeleteId = null;
function showDeleteModal(noteId) {
  pendingDeleteId = noteId;
  confirmDeleteModal.innerHTML = `
    <div class="modal-content">
      <h3 style="color: var(--shield-accent); margin-bottom: 18px;">Delete Note?</h3>
      <p style="margin-bottom: 24px;">Are you sure you want to delete this note? This action cannot be undone.</p>
      <button id="confirm-delete-btn">Delete</button>
      <button id="cancel-delete-btn">Cancel</button>
    </div>
  `;
  confirmDeleteModal.style.display = "flex";
  document.getElementById("confirm-delete-btn").onclick = () => {
    deleteNote(pendingDeleteId);
    hideDeleteModal();
  };
  document.getElementById("cancel-delete-btn").onclick = hideDeleteModal;
}

function hideDeleteModal() {
  confirmDeleteModal.style.display = "none";
  confirmDeleteModal.innerHTML = "";
  pendingDeleteId = null;
}

  noteEl.appendChild(textarea);
  noteEl.appendChild(delBtn);
  return noteEl;
}
// Saving status indicator
const saveStatus = document.getElementById("save-status");
let savingTimeout;
function setSavingStatus(isSaving) {
  if (isSaving) {
    saveStatus.innerHTML = `<span style="color: var(--shield-accent); font-weight: bold;">Saving...</span>`;
  } else {
    saveStatus.innerHTML = `<span style="color: var(--shield-accent); font-weight: bold;">Saved <span style="color: var(--shield-accent); font-size: 1.2em; vertical-align: middle;">&#10003;</span></span>`;
    // Hide check after 1.5s
    clearTimeout(savingTimeout);
    savingTimeout = setTimeout(() => {
      saveStatus.innerHTML = "";
    }, 1500);
  }
}

function autoResize() {
  this.style.height = "auto";
  this.style.height = `${this.scrollHeight}px`;
}

// ➕ Create Note
async function createNote() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, "notes"), {
      uid: user.uid,
      content: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    showMessage("Note created!");
  } catch (err) {
    console.error("Create error:", err.message);
    showMessage("Failed to create note.", "error");
  }
}

// 📝 Update Note
async function updateNote(id, content) {
  try {
    await updateDoc(doc(db, "notes", id), {
      content,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Update error:", err.message);
    showMessage("Failed to update note.", "error");
  }
}

// ❌ Delete Note
async function deleteNote(id) {
  try {
    await deleteDoc(doc(db, "notes", id));
    showMessage("Note deleted.");
  } catch (err) {
    console.error("Delete error:", err.message);
    showMessage("Failed to delete note.", "error");
  }
}

// ⏳ Debounce Utility
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

// 🔓 Logout
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showMessage("Logged out.");
  } catch (err) {
    console.error("Logout error:", err.message);
    showMessage("Logout failed.", "error");
  }
});

// 🔘 For HTML button
window.createNote = createNote;
